import { FACTORY_PROJECT_ID, type BaselineSnapshot, type FactoryWorkspace } from "./types";
import { captureBaseline } from "./crawl";
import {
  buildClientSeoSite,
  clientCrawlPaths,
  clientPreviewOrigin,
  findCatalogSite,
  hostOriginFrom,
  isStaticCatalogSiteId,
  type SeoCatalogSite,
} from "./seo-sites";
import { saveBaseline } from "./workspace";
import { readClientWorkspace, updateClientWorkspace } from "./client-workspace";
import { configFromProject } from "./client-config";
import {
  applyAutoStageProgression,
  applyBaselineCaptureResult,
  competitorAutomationStatus,
  countDraftedPages,
  defaultClientAutomation,
} from "./client-automation";

export type ClientBaselineResult = {
  snapshot: BaselineSnapshot;
  site: SeoCatalogSite;
  workspace: FactoryWorkspace;
  pagesOk: number;
  pagesTotal: number;
  limited: boolean;
};

/** True when this id should use the per-client capture path (not Sitesinc / static demos). */
export function isClientBaselineTarget(siteOrProjectId: string): boolean {
  const id = String(siteOrProjectId || "").trim();
  if (!id || id === FACTORY_PROJECT_ID) return false;
  if (isStaticCatalogSiteId(id)) return false;
  return true;
}

export async function resolveClientSeoSite(
  projectId: string,
  hostOrigin?: string
): Promise<SeoCatalogSite | null> {
  if (!isClientBaselineTarget(projectId)) return null;
  const { findProjectById } = await import("@/lib/store");
  const project = await findProjectById(projectId);
  if (!project) return null;
  const config = configFromProject(project);
  const pages = project.seededPages?.length ? project.seededPages : config.seededPages;
  return buildClientSeoSite({
    projectId,
    businessName: config.businessName || project.label || projectId,
    crawlPaths: clientCrawlPaths(pages),
    hostOrigin,
  });
}

/**
 * Crawl the client deliverable preview and bind the snapshot to THAT client only.
 * Never writes Sitesinc latestBaselineId. Never reuses Smith/Kurtis/Sitesinc inventory.
 */
export async function captureClientBaseline(opts: {
  projectId: string;
  /** Scheme+host (or full URL) of the host serving /demo/client/... */
  hostOrigin?: string;
  /** Full preview origin override; defaults to {host}/demo/client/{projectId}. */
  origin?: string;
}): Promise<ClientBaselineResult> {
  const projectId = String(opts.projectId || "").trim();
  if (!projectId) throw new Error("projectId required.");
  if (!isClientBaselineTarget(projectId)) {
    throw new Error("projectId is a static catalog site - use the standard baseline capture.");
  }

  const { findProjectById } = await import("@/lib/store");
  const project = await findProjectById(projectId);
  if (!project) throw new Error("Client project not found.");

  const workspace = await readClientWorkspace(projectId);
  if (!workspace) {
    throw new Error("Client workspace missing. Run init-client-factory first.");
  }

  const site = await resolveClientSeoSite(projectId, opts.hostOrigin);
  if (!site) throw new Error("Could not resolve client SEO site.");

  const origin = (opts.origin || site.origin || clientPreviewOrigin(projectId, opts.hostOrigin)).replace(
    /\/$/,
    ""
  );
  const paths = [...site.crawlPaths];

  const snapshot = await captureBaseline({
    origin,
    siteId: projectId,
    paths,
    source: origin.includes("sitesinc.co") && !hostOriginFrom(origin).includes("localhost")
      ? "manual"
      : "local",
    skipIntake: true,
  });

  // Hard bind: never allow catalog fallback to rewrite siteId to Sitesinc.
  snapshot.siteId = projectId;
  snapshot.projectId = projectId;

  await saveBaseline(snapshot);

  const pagesOk = snapshot.pageInventory.filter((page) => page.statusCode === 200).length;
  const pagesTotal = snapshot.pageInventory.length;
  const limited = pagesTotal === 0 || pagesOk === 0;

  const next = await updateClientWorkspace(projectId, (current) => {
    current.latestBaselineId = snapshot.id;
    current.latestBaselineBySite = {
      ...(current.latestBaselineBySite || {}),
      [projectId]: snapshot.id,
    };
    current.study.checkpoints = current.study.checkpoints.map((item) =>
      item.day === 0
        ? {
            ...item,
            status: "complete",
            capturedAt: snapshot.capturedAt,
            evidence: [snapshot.id, `origin:${origin}`],
            notes: limited
              ? `Baseline ${snapshot.id} stored but limited/empty (0 OK pages of ${pagesTotal}). Preview may be down or thin - do not invent inventory.`
              : `Client preview baseline ${snapshot.id}: ${pagesOk}/${pagesTotal} pages OK at ${origin}. Not a Sitesinc crawl.`,
          }
        : item
    );
    const baselineAuto = applyBaselineCaptureResult(current.clientAutomation?.baseline, {
      limited,
      pagesOk,
      pagesTotal,
      baselineId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      hostOrigin: opts.hostOrigin || hostOriginFrom(origin),
    });
    const automation = current.clientAutomation || defaultClientAutomation();
    current.clientAutomation = {
      ...automation,
      baseline: baselineAuto,
      competitors: competitorAutomationStatus(current.briefs),
    };
    current.stages = applyAutoStageProgression(current.stages, {
      hasResearchNotes: true,
      blueprintCount: current.blueprint.length,
      briefCount: current.briefs.length,
      draftedPageCount: countDraftedPages(current.pages),
      baselineStatus: baselineAuto.status,
    });
    current.clientAutomation.stagesAutoAppliedAt = snapshot.capturedAt;
    current.visibleGaps = current.visibleGaps.map((gap) =>
      gap.id === "client-baseline"
        ? {
            ...gap,
            status: limited ? "open" : "done",
            detail: limited
              ? `Latest baseline ${snapshot.id} is limited (${pagesOk}/${pagesTotal} OK). Recapture when preview is reachable.`
              : `Baseline ${snapshot.id} · ${snapshot.capturedAt} · ${pagesOk} pages OK.`,
          }
        : gap
    );
    return current;
  });

  return { snapshot, site, workspace: next, pagesOk, pagesTotal, limited };
}

/** List CRM client projects that should appear as SEO sites (initialized factory path). */
export async function listClientSeoCatalogSites(hostOrigin?: string): Promise<SeoCatalogSite[]> {
  const { listProjects } = await import("@/lib/store");
  const projects = await listProjects();
  const out: SeoCatalogSite[] = [];
  for (const project of projects) {
    if (!isClientBaselineTarget(project.id)) continue;
    if (!project.factoryWorkspaceId && !project.seededPages?.length && !project.templateId) {
      continue;
    }
    const workspace = await readClientWorkspace(project.id);
    // Show once the client factory path exists (workspace) or structured seed is present.
    if (!workspace && !project.seededPages?.length) continue;
    const config = configFromProject(project);
    const pages = project.seededPages?.length ? project.seededPages : config.seededPages;
    out.push(
      buildClientSeoSite({
        projectId: project.id,
        businessName: config.businessName || project.label || project.id,
        crawlPaths: clientCrawlPaths(pages),
        hostOrigin,
      })
    );
  }
  return out;
}

/** Resolve any site id: static catalog, or live client project. */
export async function resolveSeoSite(
  siteId: string | undefined,
  hostOrigin?: string
): Promise<SeoCatalogSite> {
  if (siteId) {
    const staticSite = findCatalogSite(siteId);
    if (staticSite) return staticSite;
    const client = await resolveClientSeoSite(siteId, hostOrigin);
    if (client) return client;
  }
  return findCatalogSite(FACTORY_PROJECT_ID)!;
}
