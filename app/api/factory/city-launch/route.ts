import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import {
  approveCityDrafts,
  cityLaunchSummary,
  controlCityBatch,
  pickCities,
  queueCityLaunchBatch,
  readCityDraft,
  readCityIndex,
  regenerateCityDraft,
  runCityGate,
  saveCityDraftEdit,
  setCityDraftStatus,
  signOffCityProduction,
  type CityPickRequest,
  type DraftEdit,
  type QueueBatchInput,
} from "@/lib/factory/city-launch";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { findProjectById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET ?projectId=...&batchId=...  -> provider status (names only), page registry, active batch progress. */
export async function GET(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const projectId = req.nextUrl.searchParams.get("projectId") || "";
    const slug = req.nextUrl.searchParams.get("slug") || "";
    if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
    if (slug) {
      const draft = await readCityDraft(projectId, slug);
      if (!draft) return NextResponse.json({ ok: false, error: "Draft not found." }, { status: 404 });
      const index = await readCityIndex(projectId);
      return NextResponse.json({ ok: true, draft, entry: index?.pages[slug] || null });
    }
    const summary = await cityLaunchSummary(projectId, req.nextUrl.searchParams.get("batchId") || undefined);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return factoryErrorResponse(err, "City Launch status failed");
  }
}

/**
 * POST { op, projectId, ... }
 *   pick        { request: CityPickRequest }                       preview cities (no writes)
 *   queue       { batch: QueueBatchInput }                         queue + auto-start a batch (<= 500)
 *   control     { batchId, action: pause|resume|cancel|retry_failed }
 *   edit        { slug, edit: DraftEdit }                          operator edit (re-approval required)
 *   regenerate  { slug }                                           one fresh LLM draft
 *   approve     { slugs[], approvedBy, allowWarn? }                human approval (gate must not block)
 *   reject      { slug, reason? } / reopen { slug }
 *   gate        {}                                                 recompute uniqueness/quality gate
 *   signoff-production { approvedBy }                              Tony's real-domain sign-off (records only)
 */
export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const op = String(body.op || "");
    const projectId = String(body.projectId || "").trim();
    const actor = String(body.approvedBy || body.actor || "operator").slice(0, 80);
    if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });
    const project = await findProjectById(projectId);
    if (!project) return NextResponse.json({ ok: false, error: "Client project not found." }, { status: 404 });
    const hostOrigin = req.nextUrl?.origin || null;
    const reply = (result: { ok: boolean; error?: string } & Record<string, unknown>) =>
      NextResponse.json(result, { status: result.ok ? 200 : 400 });

    switch (op) {
      case "pick":
        return reply(pickCities(project, (body.request || {}) as CityPickRequest));
      case "queue":
        return reply(await queueCityLaunchBatch(projectId, (body.batch || {}) as QueueBatchInput, actor, { hostOrigin }));
      case "control": {
        const action = String(body.action || "") as "pause" | "resume" | "cancel" | "retry_failed";
        if (!["pause", "resume", "cancel", "retry_failed"].includes(action)) return reply({ ok: false, error: "Unknown action." });
        return reply(await controlCityBatch(projectId, String(body.batchId || ""), action, actor, hostOrigin));
      }
      case "edit":
        return reply(await saveCityDraftEdit(projectId, String(body.slug || ""), (body.edit || {}) as DraftEdit, actor));
      case "regenerate":
        return reply(await regenerateCityDraft(projectId, String(body.slug || ""), actor));
      case "approve": {
        const slugs = Array.isArray(body.slugs) ? body.slugs.map(String).slice(0, 500) : [];
        if (!slugs.length) return reply({ ok: false, error: "slugs required" });
        return reply(await approveCityDrafts(projectId, slugs, String(body.approvedBy || ""), { allowWarn: body.allowWarn !== false }));
      }
      case "reject":
        return reply(await setCityDraftStatus(projectId, String(body.slug || ""), "rejected", actor, String(body.reason || "")));
      case "reopen":
        return reply(await setCityDraftStatus(projectId, String(body.slug || ""), "draft", actor));
      case "gate":
        return reply({ ok: true, gate: await runCityGate(projectId) });
      case "signoff-production":
        return reply(await signOffCityProduction(projectId, String(body.approvedBy || "")));
      default:
        return reply({ ok: false, error: `Unknown op "${op}".` });
    }
  } catch (err) {
    return factoryErrorResponse(err, "City Launch action failed");
  }
}
