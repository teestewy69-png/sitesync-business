import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isValidSession } from "@/lib/factory/auth";
import { createOutboundCall, getRetellConfig } from "@/lib/retell";
import {
  isSuppressed,
  isWithinCallingHours,
  loadSuppressionList,
  normalizePhoneDigits,
  STATE_TIMEZONES,
} from "@/lib/retell-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator-only: place ONE Retell outbound appointment-setting call
 * (see docs/retell.md). Auth is enforced by middleware.ts
 * (matcher /api/factory/*) and re-checked here, same as every factory route.
 *
 * Both outbound agents exist to set an appointment for Tony to call back
 * and close. TCPA guards from lib/retell-guards.ts run before Retell is
 * contacted: suppression list first, then calling hours for the lead's
 * state timezone (08:00–20:45 local).
 */
export async function POST(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(FACTORY_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "Factory authentication required." }, { status: 401 });
  }

  const config = getRetellConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "Retell is not configured: set RETELL_API_KEY in the Netlify environment." },
      { status: 503 }
    );
  }
  if (!config.fromNumber) {
    return NextResponse.json(
      { ok: false, error: "Retell is not configured: set RETELL_FROM_NUMBER in the Netlify environment." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    phone?: unknown;
    business?: unknown;
    city?: unknown;
    state?: unknown;
    agent?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "JSON body required." }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const business = typeof body.business === "string" ? body.business.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  const agent = body.agent === 1 || body.agent === 2 ? body.agent : null;

  if (agent === null) {
    return NextResponse.json({ ok: false, error: "agent must be 1 or 2." }, { status: 400 });
  }
  const agentId = agent === 1 ? config.agentOutbound1Id : config.agentOutbound2Id;
  if (!agentId) {
    return NextResponse.json(
      {
        ok: false,
        error: `Retell is not configured: set RETELL_AGENT_OUTBOUND_${agent}_ID in the Netlify environment.`,
      },
      { status: 503 }
    );
  }

  const digits = normalizePhoneDigits(phone);
  if (digits.length !== 10) {
    return NextResponse.json(
      { ok: false, error: `"${phone}" is not a valid 10-digit US phone number.` },
      { status: 400 }
    );
  }

  if (isSuppressed(phone, loadSuppressionList())) {
    return NextResponse.json(
      { ok: false, error: "That number is on the do-not-call suppression list." },
      { status: 403 }
    );
  }

  const timeZone = STATE_TIMEZONES[state];
  if (!timeZone) {
    return NextResponse.json(
      { ok: false, error: `No timezone mapping for state "${state}"; add it to STATE_TIMEZONES first.` },
      { status: 400 }
    );
  }
  if (!isWithinCallingHours(new Date(), timeZone)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Outside calling hours for ${state} (${timeZone}); outbound calls run 08:00–20:45 local time.`,
      },
      { status: 422 }
    );
  }

  try {
    const result = await createOutboundCall({
      toNumber: `+1${digits}`,
      agentId,
      dynamicVariables: {
        business_name: business,
        city,
        callback_offer: "appointment",
      },
    });
    return NextResponse.json({ ok: true, callId: result.call_id ?? null });
  } catch (err) {
    console.error("Retell outbound call failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Retell call failed." },
      { status: 502 }
    );
  }
}
