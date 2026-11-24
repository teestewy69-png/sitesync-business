import { NextRequest, NextResponse } from "next/server";
import { ensureBlobsFromRequest, findLeadById } from "@/lib/store";
import { sendSubscribeEmails } from "@/lib/subscribe-mail";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fired by the capture forms (fire-and-forget, keepalive) right after a
// subscribe succeeds, so the confirmation + notification emails send in
// their own invocation and the visitor never waits on the mail server.
// Only acts on a real lead whose confirmation is still unsent and that
// was created in the last 15 minutes; the shared sender claims the lead
// before sending, so repeat fires cannot produce duplicates.
export async function POST(req: NextRequest) {
  const limited = rateLimit(`subscribe-notify:${clientKey(req)}`, 5, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
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
  if (lead.notificationState === "sent" || lead.notificationState === "sending") {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (Date.now() - Date.parse(lead.createdAt) > 15 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await sendSubscribeEmails(leadId);
  return NextResponse.json({ ok: true });
}
