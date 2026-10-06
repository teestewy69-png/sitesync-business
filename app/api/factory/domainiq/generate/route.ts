import { NextRequest, NextResponse } from "next/server";
import { DOMAINIQ_ENGINE_VERSION } from "@/lib/domainiq";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { discoverClientDomains, generateDomainCandidatesForProject } from "@/lib/factory/domainiq";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { projectId, force?, checkAvailability? }   -> generate + persist for a client project
 * POST { niche, businessName?, city?, state?, checkAvailability? } -> ad-hoc suggestions (not persisted)
 */
export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const projectId = String(body.projectId || "").trim();
    if (projectId) {
      const result = await generateDomainCandidatesForProject(projectId, {
        force: body.force !== false,
        checkAvailability: body.checkAvailability !== false,
      });
      if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      const project = result.project;
      return NextResponse.json({
        ok: true,
        engine: DOMAINIQ_ENGINE_VERSION,
        projectId,
        domainStatus: project?.domainStatus,
        selectedDomain: project?.selectedDomain || null,
        domainCandidates: project?.domainCandidates || [],
        domainIQ: project?.domainIQ,
      });
    }
    const run = await discoverClientDomains(
      {
        businessName: String(body.businessName || ""),
        niche: String(body.niche || ""),
        city: String(body.city || ""),
        state: String(body.state || ""),
      },
      { checkAvailability: body.checkAvailability === true }
    );
    const out = run.out;
    if (!out.ok) return NextResponse.json({ ok: false, error: out.reason }, { status: 400 });
    return NextResponse.json({
      ok: true,
      engine: DOMAINIQ_ENGINE_VERSION,
      persisted: false,
      seed: out.seed,
      meta: out.meta,
      availabilityChecked: run.availabilityChecked,
      candidates: run.candidates,
    });
  } catch (err) {
    return factoryErrorResponse(err, "DomainIQ generation failed");
  }
}
