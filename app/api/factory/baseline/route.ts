import { NextRequest, NextResponse } from "next/server";
import { captureBaseline } from "@/lib/factory/crawl";
import { catalogSite } from "@/lib/factory/seo-sites";
import { FACTORY_PROJECT_ID } from "@/lib/factory/types";
import { saveBaseline, updateWorkspace } from "@/lib/factory/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { origin?: string; siteId?: string };
    const site = catalogSite(body.siteId);
    const origin = (body.origin || site.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://sitesinc.co").replace(
      /\/$/,
      ""
    );
    const snapshot = await captureBaseline({
      origin,
      siteId: body.siteId || site.id,
    });
    await saveBaseline(snapshot);
    await updateWorkspace((workspace) => {
      const id = snapshot.siteId || site.id;
      workspace.latestBaselineBySite = { ...(workspace.latestBaselineBySite || {}), [id]: snapshot.id };
      if (id === FACTORY_PROJECT_ID) workspace.latestBaselineId = snapshot.id;
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
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Baseline failed" },
      { status: 500 }
    );
  }
}