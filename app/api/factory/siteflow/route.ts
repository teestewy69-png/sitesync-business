import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { runAfterResponse } from "@/lib/siteflow/after";
import { effectiveStatus, isValidRate, payoutRows } from "@/lib/siteflow/commission-math";
import { markManualFulfilled, retryFulfillment } from "@/lib/siteflow/fulfillment";
import { normalizeRefCode, partnerLink } from "@/lib/siteflow/ref";
import {
  createPartner,
  getPartner,
  listCommissions,
  listPartners,
  putCommission,
  putPartner,
} from "@/lib/siteflow/state";
import { checkStripeCatalog } from "@/lib/siteflow/stripe-status";
import { summarizeSiteFlow } from "@/lib/siteflow/summary";
import { isValidEmail, normalizeEmail } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function origin(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
}

/** Factory-only (middleware enforces the factory session on /api/factory/*). */
export async function GET(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    return NextResponse.json({ ok: true, summary: await summarizeSiteFlow() });
  } catch (err) {
    return factoryErrorResponse(err, "SiteFlow summary failed");
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const op = String(body.op || "");
    const orderId = String(body.orderId || "").slice(0, 80);

    switch (op) {
      case "retry-fulfillment": {
        if (!orderId) return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 });
        runAfterResponse(`retry ${orderId}`, () => retryFulfillment(orderId));
        return NextResponse.json({ ok: true, queued: true, message: "Retry started. Refresh in a minute." }, { status: 202 });
      }
      case "mark-fulfilled": {
        const order = await markManualFulfilled(orderId);
        if (!order) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
        return NextResponse.json({ ok: true, status: order.status });
      }
      case "add-partner": {
        const code = normalizeRefCode(body.code);
        const name = String(body.name || "").trim().slice(0, 120);
        const email = normalizeEmail(body.email);
        const ratePct = Number(body.ratePct);
        const recurringPayments = Math.max(0, Math.min(120, Math.floor(Number(body.recurringPayments) || 0)));
        if (!code) return NextResponse.json({ ok: false, error: "Code: 2-32 chars, a-z, 0-9 and dashes." }, { status: 400 });
        if (!name) return NextResponse.json({ ok: false, error: "Partner name required." }, { status: 400 });
        if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "Valid partner email required (used for payouts and the self-referral check)." }, { status: 400 });
        if (!isValidRate(ratePct)) return NextResponse.json({ ok: false, error: "Commission rate (%) is required: more than 0, at most 100." }, { status: 400 });
        const at = new Date().toISOString();
        const created = await createPartner({ code, name, email, ratePct, recurringPayments, status: "active", createdAt: at, updatedAt: at });
        if (!created) return NextResponse.json({ ok: false, error: `Partner code "${code}" already exists.` }, { status: 409 });
        return NextResponse.json({ ok: true, code, link: partnerLink(origin(req), code) });
      }
      case "set-partner-status": {
        const partner = await getPartner(normalizeRefCode(body.code));
        if (!partner) return NextResponse.json({ ok: false, error: "Partner not found" }, { status: 404 });
        const status = body.status === "paused" ? "paused" : "active";
        await putPartner({ ...partner, status, updatedAt: new Date().toISOString() });
        return NextResponse.json({ ok: true, status });
      }
      case "approve-due": {
        const now = Date.now();
        let approved = 0;
        for (const c of await listCommissions()) {
          if (c.status === "pending" && effectiveStatus(c, now) === "approved") {
            await putCommission({ ...c, status: "approved", approvedAt: new Date(now).toISOString() });
            approved += 1;
          }
        }
        return NextResponse.json({ ok: true, approved });
      }
      case "mark-payout-paid": {
        const month = String(body.month || "");
        const commissions = await listCommissions();
        const rows = payoutRows(commissions, await listPartners(), month);
        const ids = new Set(rows.flatMap((r) => r.commissionIds));
        const at = new Date().toISOString();
        for (const c of commissions) {
          if (ids.has(c.id)) await putCommission({ ...c, status: "paid", payoutAt: at, payoutMonth: month, approvedAt: c.approvedAt || at });
        }
        return NextResponse.json({ ok: true, marked: ids.size });
      }
      case "check-stripe": {
        const status = await checkStripeCatalog();
        return NextResponse.json({ ok: !status.error, ...(status.error ? { error: status.error } : { message: "Stripe catalog checked (read-only)." }), status });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown op" }, { status: 400 });
    }
  } catch (err) {
    return factoryErrorResponse(err, "SiteFlow action failed", 400);
  }
}
