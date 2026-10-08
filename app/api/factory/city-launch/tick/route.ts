import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { queueCityLaunchTick, readCityBatch } from "@/lib/factory/city-launch";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { projectId, batchId } -> 202; runs one lease-guarded tick after the response.
 * Called by the batch itself (self-chaining between Netlify invocations), by the operator panel's
 * auto-resume poll, or by hand. Idempotent: a tick that finds the lease held exits immediately.
 */
export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const projectId = String(body.projectId || "");
    const batchId = String(body.batchId || "");
    const batch = await readCityBatch(projectId, batchId);
    if (!batch) return NextResponse.json({ ok: false, error: "Batch not found." }, { status: 404 });
    if (!["queued", "running", "blocked_missing_key"].includes(batch.status)) {
      return NextResponse.json({ ok: true, queued: false, status: batch.status });
    }
    const leaseHeld = Boolean(batch.lease && Date.parse(batch.lease.until) > Date.now());
    if (!leaseHeld) queueCityLaunchTick(projectId, batchId, req.nextUrl?.origin || null);
    return NextResponse.json({ ok: true, queued: !leaseHeld, leaseHeld, status: batch.status }, { status: 202 });
  } catch (err) {
    return factoryErrorResponse(err, "City Launch tick failed");
  }
}
