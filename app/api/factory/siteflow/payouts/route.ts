import { NextRequest, NextResponse } from "next/server";
import { siteflowEnabled, siteflowPausedResponse } from "@/lib/siteflow/flag";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { payoutCsv, payoutRows } from "@/lib/siteflow/commission-math";
import { listCommissions, listPartners } from "@/lib/siteflow/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?month=2026-10 → payout CSV (approved, unpaid commissions by partner). Payouts themselves are manual. */
export async function GET(req: NextRequest) {
  // SiteFlow is paused (Path A) unless SITEFLOW_ENABLED is set; middleware also 404s this path.
  if (!siteflowEnabled()) return siteflowPausedResponse();
  try {
    ensureBlobsFromRequest(req);
    const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const csv = payoutCsv(payoutRows(await listCommissions(), await listPartners(), month), month);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="siteflow-payouts-${month.replace(/[^0-9-]/g, "")}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return factoryErrorResponse(err, "Payout export failed", 400);
  }
}
