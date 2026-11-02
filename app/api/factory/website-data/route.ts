import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { listWebsiteDataSites, loadWebsiteData } from "@/lib/factory/website-data";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const site = req.nextUrl.searchParams.get("site") || undefined;
    const preset = req.nextUrl.searchParams.get("preset") || undefined;
    const from = req.nextUrl.searchParams.get("from") || undefined;
    const to = req.nextUrl.searchParams.get("to") || undefined;
    const [report, sites] = await Promise.all([
      loadWebsiteData({ siteId: site, preset, from, to }),
      listWebsiteDataSites(),
    ]);
    if ("error" in report) {
      return NextResponse.json({ ok: false, error: report.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, report, sites });
  } catch (err) {
    return factoryErrorResponse(err, "Website data request failed.");
  }
}
