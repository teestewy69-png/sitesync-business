import { NextRequest, NextResponse } from "next/server";
import { ensureBlobsFromRequest, findLeadById } from "@/lib/store";
import { FREE_AUDIT_SOURCE, sendAuditEmail } from "@/lib/audit-mail";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fired by the audit capture form (fire-and-forget, keepalive) right after a
// request succeeds, so the deep audit and the results email run in their own
// invocation and the visitor never waits on either. Only acts on a real
// free-audit lead whose email is still unsent and that was requested in the
// last 60 minutes; the shared sender claims the lead before working, so
// repeat fires cannot produce duplicates.
export async function POST(req: NextRequest) {
  const limited = rateLimit(`free-audit-send:${clientKey(req)}`, 5, 10 * 60 * 1000);
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
  if (lead.source !== FREE_AUDIT_SOURCE) {
    return NextResponse.json({ ok: false, error: "Not an audit lead." }, { status: 400 });
  }
  if (lead.notificationState === "sent" || lead.notificationState === "sending") {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (Date.now() - Date.parse(lead.createdAt) > 60 * 60 * 1000) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await sendAuditEmail(leadId);
  return NextResponse.json({ ok: true });
}
