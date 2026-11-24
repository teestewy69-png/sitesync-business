import { NextRequest, NextResponse } from "next/server";
import { ensureBlobsFromRequest, findLeadById } from "@/lib/store";
import { sendSubscribeEmails } from "@/lib/subscribe-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Netlify background route (the "-background" suffix): the platform answers
// the caller with 202 immediately and this handler keeps running for up to
// 15 minutes, so the subscribe form never waits on the mail server. The
// response body is discarded by the platform; status codes only matter for
// the local / non-Netlify fallback path in the subscribe route.
//
// Gated by a shared secret (SUBSCRIBE_NOTIFY_SECRET) so the endpoint cannot
// be used as a mail relay: it only ever sends for a real saved lead whose
// notification is still pending, and sendSubscribeEmails is idempotent.
export async function POST(req: NextRequest) {
  const secret = process.env.SUBSCRIBE_NOTIFY_SECRET || "";
  if (!secret || req.headers.get("x-subscribe-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const leadId = typeof body?.leadId === "string" ? body.leadId : "";
  if (!leadId.startsWith("lead_")) {
    return NextResponse.json({ ok: false, error: "Missing lead id." }, { status: 400 });
  }

  ensureBlobsFromRequest(req);
  const lead = await findLeadById(leadId);
  if (!lead) {
    return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
  }
  if (lead.notificationState === "sent") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await sendSubscribeEmails(leadId);
  return NextResponse.json({ ok: true });
}
