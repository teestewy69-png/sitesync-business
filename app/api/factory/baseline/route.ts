import { NextRequest, NextResponse } from "next/server";
import { captureBaseline } from "@/lib/factory/crawl";
import { saveBaseline, updateWorkspace } from "@/lib/factory/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { origin?: string };
    const origin = (body.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://sitesinc.co").replace(/\/$/, "");
    const snapshot = await captureBaseline({
      origin,
      source: origin.includes("sitesinc.co") ? "live_production" : "local",
    });
    await saveBaseline(snapshot);
    await updateWorkspace((workspace) => {
      workspace.latestBaselineId = snapshot.id;
      workspace.screenshots = workspace.screenshots;
      return workspace;
    });
    return NextResponse.json({ ok: true, id: snapshot.id, capturedAt: snapshot.capturedAt, pages: snapshot.pageInventory.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Baseline failed" },
      { status: 500 }
    );
  }
}
