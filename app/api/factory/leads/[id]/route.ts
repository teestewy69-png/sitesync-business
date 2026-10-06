import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isValidSession } from "@/lib/factory/auth";
import { isLeadStage, LEAD_STAGES } from "@/lib/lead-stage";
import { ensureBlobsFromRequest, updateRecordStage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[a-z]+_[a-z0-9]{4,64}$/i;

/**
 * Operator-only: set the pipeline stage of a lead, a past product inquiry (the shop was removed 2026-10-05), or project.
 * Auth is enforced by middleware.ts (matcher /api/factory/*) and re-checked here.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isValidSession(req.cookies.get(FACTORY_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "Factory authentication required." }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ ok: false, error: "Invalid record id." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { stage?: unknown } | null;
  if (!body || typeof body !== "object" || !isLeadStage(body.stage)) {
    return NextResponse.json(
      { ok: false, error: `stage must be one of: ${LEAD_STAGES.join(", ")}.` },
      { status: 400 }
    );
  }
  try {
    ensureBlobsFromRequest(req);
    const result = await updateRecordStage(id, body.stage);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Record not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Stage update failed:", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ ok: false, error: "Could not save stage." }, { status: 500 });
  }
}
