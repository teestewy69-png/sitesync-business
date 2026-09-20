import { NextRequest, NextResponse } from "next/server";
import { applyFactoryAction } from "@/lib/factory/actions";
import { captureBaseline } from "@/lib/factory/crawl";
import { PRODUCTION_ORIGIN } from "@/lib/factory/pipeline";
import { asNonEmptyString } from "@/lib/validate";
import {
  getFactoryPayload,
  recordEvent,
  saveBaseline,
  updateWorkspace,
} from "@/lib/factory/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function originFrom(req: NextRequest) {
  return req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Factory request failed.";
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getFactoryPayload()) });
  } catch (err) {
    console.error("Factory GET error:", err);
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, string>;
    const action = asNonEmptyString(body.action || body.op, 40);
    const local = originFrom(req);

    if (action === "capture_baseline" || action === "capture-baseline") {
      const target = asNonEmptyString(body.origin, 200) || PRODUCTION_ORIGIN;
      const snapshot = await captureBaseline({
        origin: target,
        source: target.includes("sitesinc.co") ? "live_production" : "local",
      });
      await saveBaseline(snapshot);
      await updateWorkspace((workspace) => {
        workspace.latestBaselineId = snapshot.id;
        return workspace;
      });
      return NextResponse.json({ ok: true, ...(await getFactoryPayload()) });
    }

    if (action === "capture_local_baseline") {
      const snapshot = await captureBaseline({ origin: local, source: "local" });
      await saveBaseline(snapshot);
      await updateWorkspace((workspace) => {
        workspace.latestBaselineId = snapshot.id;
        return workspace;
      });
      return NextResponse.json({ ok: true, ...(await getFactoryPayload()) });
    }

    if (action === "track_event") {
      const types = [
        "cta_click",
        "intake_start",
        "intake_success",
        "email_notification",
        "internal_project",
        "mobile_complete",
      ] as const;
      const type = types.find((item) => item === body.type);
      if (!type) {
        return NextResponse.json({ ok: false, error: "Unknown event type." }, { status: 400 });
      }
      await recordEvent(type, asNonEmptyString(body.path, 200) || "/", asNonEmptyString(body.meta, 200));
      return NextResponse.json({ ok: true });
    }

    const mapped: Record<string, string> = {
      patch_stage: "approve-stage",
      patch_brief: "approve-brief",
      deploy_staging: "stage-pages",
      deploy_production: "publish-pages",
      rollback: "rollback",
      add_backlink: "add-backlink",
      run_conversions: "run-conversions",
      submit_indexing: "submit-indexing",
    };
    const op = mapped[action] || action;
    const result = await applyFactoryAction(op, {
      ...body,
      origin: body.origin || local,
      approvedBy: asNonEmptyString(body.approvedBy, 80) || "operator",
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ ...result, ...(await getFactoryPayload()) });
  } catch (err) {
    console.error("Factory POST error:", err);
    return errorResponse(err);
  }
}
