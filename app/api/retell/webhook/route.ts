import { NextRequest, NextResponse } from "next/server";
import { getNotifyEmail, sendMail } from "@/lib/mail";
import { getRetellConfig, verifyRetellSignature } from "@/lib/retell";
import { appendLead, ensureBlobsFromRequest, findLeadById, stableId, updateLead } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retell AI webhook (see docs/retell.md). Point the Retell dashboard's
 * webhook URL at https://sitesinc.co/api/retell/webhook.
 *
 * Signature-gated (x-retell-signature). On call_ended / call_analyzed the
 * call is saved as a lead (source "retell") in the same store as the public
 * subscribe form, and Tony is notified by email at the notify address.
 * Retries are safe: the lead id is derived from the Retell call id.
 */

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Finds a string value in a record by any of the given keys (case-insensitive). */
function pickString(record: AnyRecord, keys: string[]): string {
  for (const key of Object.keys(record)) {
    if (keys.includes(key.toLowerCase())) {
      const value = asString(record[key]);
      if (value) return value;
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const config = getRetellConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "Retell is not configured on this site." },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  if (!verifyRetellSignature(rawBody, req.headers.get("x-retell-signature"))) {
    return NextResponse.json({ ok: false, error: "Invalid Retell signature." }, { status: 401 });
  }

  let payload: AnyRecord;
  try {
    payload = asRecord(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const event = asString(payload.event);
  if (event !== "call_ended" && event !== "call_analyzed") {
    // call_started and anything else: acknowledged, nothing to store.
    return NextResponse.json({ ok: true, ignored: event || "unknown" });
  }

  try {
    ensureBlobsFromRequest(req);

    const call = asRecord(payload.call ?? payload.data ?? payload);
    const analysis = asRecord(call.call_analysis ?? payload.call_analysis);
    const custom = asRecord(analysis.custom_analysis_data);

    const callId = asString(call.call_id) || asString(payload.call_id);
    const agentId = asString(call.agent_id);
    const direction = asString(call.direction) || "unknown";
    const fromNumber = asString(call.from_number);
    const toNumber = asString(call.to_number);
    // The person we talked to: the caller on inbound, the called party on outbound.
    const phone = direction === "outbound" ? toNumber || fromNumber : fromNumber || toNumber;
    const summary = asString(analysis.call_summary) || asString(analysis.summary);
    const transcript = asString(call.transcript);
    const name =
      pickString(custom, ["name", "caller_name", "contact_name", "full_name", "business", "business_name"]) ||
      `Retell ${direction} call`;
    const email = pickString(custom, ["email", "email_address"]);

    const leadId = await stableId("lead", `retell:${callId || `${phone}:${Date.now()}`}`);
    const existing = await findLeadById(leadId);
    if (existing) {
      return NextResponse.json({ ok: true, id: leadId, duplicate: true });
    }

    const detailLines = [
      `Retell ${event}`,
      `Direction: ${direction}`,
      phone ? `Phone: ${phone}` : "",
      fromNumber ? `From: ${fromNumber}` : "",
      toNumber ? `To: ${toNumber}` : "",
      agentId ? `Agent: ${agentId}` : "",
      callId ? `Call ID: ${callId}` : "",
      summary ? `\nSummary:\n${summary}` : "",
      transcript ? `\nTranscript:\n${clip(transcript, 3500)}` : "",
    ].filter(Boolean);

    const lead = await appendLead({
      id: leadId,
      name,
      email,
      source: "retell",
      createdAt: new Date().toISOString(),
      details: clip(detailLines.join("\n"), 4000),
      linkageState: "project_pending",
      idempotencyKey: callId ? `retell:${callId}` : undefined,
    });

    let mailed = { sent: false };
    try {
      mailed = await sendMail({
        to: getNotifyEmail(),
        subject: `Retell ${direction} call: ${phone || "unknown number"}`,
        text: `A Retell AI call just ended.\n\n${detailLines.join("\n")}\n\nLead ID: ${lead.id}`,
      });
    } catch (err) {
      console.error("Retell notification email error:", err);
    }
    await updateLead(lead.id, {
      notificationState: mailed.sent ? "sent" : "failed",
    }).catch(() => null);

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error(
      "Retell webhook error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json({ ok: false, error: "Could not record the call." }, { status: 500 });
  }
}
