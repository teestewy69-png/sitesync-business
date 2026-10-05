import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { isDemoBaseline } from "@/lib/factory/baseline-pick";
import {
  captureClientBaseline,
  isClientBaselineTarget,
} from "@/lib/factory/client-baseline";
import { captureBaseline } from "@/lib/factory/crawl";
import { findCatalogSite, hostOriginFrom } from "@/lib/factory/seo-sites";
import { FACTORY_PROJECT_ID } from "@/lib/factory/types";
import { saveBaseline, updateWorkspace } from "@/lib/factory/workspace";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as {
      origin?: string;
      siteId?: string;
      projectId?: string;
    };

    const projectId = String(body.projectId || body.siteId || "").trim();
    const host = hostOriginFrom(req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL);

    // Per-client path: crawl /demo/client/<projectId> and bind ONLY to that client workspace.
    if (projectId && isClientBaselineTarget(projectId)) {
      const result = await captureClientBaseline({
        projectId,
        hostOrigin: host,
        origin: body.origin,
      });
      return NextResponse.json({
        ok: true,
        id: result.snapshot.id,
        siteId: result.snapshot.siteId,
        projectId,
        capturedAt: result.snapshot.capturedAt,
        pages: result.pagesTotal,
        pagesOk: result.pagesOk,
        limited: result.limited,
        origin: result.snapshot.origin,
      });
    }

    const site = findCatalogSite(body.siteId) || findCatalogSite(FACTORY_PROJECT_ID)!;
    const origin = (body.origin || site.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://sitesinc.co").replace(
      /\/$/,
      ""
    );
    const snapshot = await captureBaseline({
      origin,
      siteId: body.siteId || site.id,
      paths: [...site.crawlPaths],
    });
    await saveBaseline(snapshot);
    await updateWorkspace((workspace) => {
      const id = snapshot.siteId || site.id;
      workspace.latestBaselineBySite = { ...(workspace.latestBaselineBySite || {}), [id]: snapshot.id };
      // Never point the case study at a demo crawl (e.g. a /demo/ origin captured under the default site id).
      if (id === FACTORY_PROJECT_ID && !isDemoBaseline(snapshot)) workspace.latestBaselineId = snapshot.id;
      return workspace;
    });
    return NextResponse.json({
      ok: true,
      id: snapshot.id,
      siteId: snapshot.siteId,
      capturedAt: snapshot.capturedAt,
      pages: snapshot.pageInventory.length,
    });
  } catch (err) {
    return factoryErrorResponse(err, "Baseline failed");
  }
}