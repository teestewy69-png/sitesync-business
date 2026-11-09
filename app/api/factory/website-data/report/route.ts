import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { FACTORY_COOKIE, isValidSession } from "@/lib/factory/auth";
import { loadWebsiteData } from "@/lib/factory/website-data";
import { renderClientReport } from "@/lib/factory/website-data-report";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click client report (Website Data Rec #4): renders the same report the
 * dashboard is showing — same site/period params, same cached loader — as a
 * standalone HTML document the operator can download and hand to the client.
 *
 * Auth is enforced by middleware.ts (matcher /api/factory/*) and re-checked
 * here, same as every factory route. A not_connected report still downloads:
 * the document carries the honest not-connected notices, matching how the
 * dashboard page renders that state instead of erroring.
 */
export async function GET(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(FACTORY_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "Factory authentication required." }, { status: 401 });
  }
  try {
    ensureBlobsFromRequest(req);
    const site = req.nextUrl.searchParams.get("site") || undefined;
    const preset = req.nextUrl.searchParams.get("preset") || undefined;
    const from = req.nextUrl.searchParams.get("from") || undefined;
    const to = req.nextUrl.searchParams.get("to") || undefined;
    const report = await loadWebsiteData({ siteId: site, preset, from, to });
    if ("error" in report) {
      return NextResponse.json({ ok: false, error: report.error }, { status: 400 });
    }
    const html = renderClientReport(report);
    const slug = report.site.id.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "site";
    const filename = `website-report-${slug}-${report.period.start}-to-${report.period.end}.html`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return factoryErrorResponse(err, "Website report request failed.");
  }
}
