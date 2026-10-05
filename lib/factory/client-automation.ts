/**
 * Per-client factory automation: baseline auto-capture/recapture, stage
 * progression, draft seeding helpers, backfill selection, competitor provider.
 * Honest host resolution only - never invents production URLs for crawl.
 */
import type {
  ClientAutomationState,
  ClientBaselineAutomation,
  ClientBaselineAutoStatus,
  ClientCompetitorAutomation,
  ClientDraftsAutomation,
  ContentBrief,
  FactoryPage,
  FactoryStage,
  FactoryWorkspace,
  StageKey,
  StageStatus,
} from "./types";

export type {
  ClientAutomationState,
  ClientBaselineAutomation,
  ClientBaselineAutoStatus,
  ClientCompetitorAutomation,
  ClientDraftsAutomation,
};

/** Env keys this repo would recognize for a SERP/search provider (none wired today). */
export const SEARCH_PROVIDER_ENV_KEYS = [
  "SERPER_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "BRAVE_API_KEY",
  "SERPAPI_API_KEY",
  "BING_SEARCH_API_KEY",
] as const;

export function detectSearchProvider(): { configured: boolean; provider: string } {
  for (const key of SEARCH_PROVIDER_ENV_KEYS) {
    const value = (process.env[key] || "").trim();
    if (value) return { configured: true, provider: key };
  }
  return { configured: false, provider: "" };
}

export function competitorAutomationStatus(briefs?: ContentBrief[]): ClientCompetitorAutomation {
  const detected = detectSearchProvider();
  const filled =
    (briefs || []).some((brief) => (brief.competitorUrls || []).length > 0) || false;
  if (filled) {
    return {
      status: "filled",
      detail: "At least one brief has competitorUrls attached (operator or provider).",
      provider: detected.provider || undefined,
    };
  }
  if (!detected.configured) {
    return {
      status: "needs_search_provider",
      detail:
        "No search/SERP API key in env (e.g. SERPER_API_KEY / BRAVE_SEARCH_API_KEY). Analyze top 3 stays manual - never invent competitor domains.",
    };
  }
  return {
    status: "manual",
    detail: `Search provider env ${detected.provider} is present but auto-fill is not wired yet. Attach competitorUrls via set-brief-competitors.`,
    provider: detected.provider,
  };
}

/**
 * Resolve a crawl host origin honestly.
 * Order: explicit hint → DEPLOY_PRIME_URL → URL → NEXT_PUBLIC_SITE_URL.
 * Returns null (do not crawl) when nothing usable is set - never invents sitesinc.co.
 */
export function resolveAutomationHostOrigin(explicit?: string | null): {
  hostOrigin: string | null;
  source: string;
  reason?: string;
} {
  const candidates: Array<{ value: string; source: string }> = [
    { value: String(explicit || "").trim(), source: "explicit" },
    { value: (process.env.DEPLOY_PRIME_URL || "").trim(), source: "DEPLOY_PRIME_URL" },
    { value: (process.env.URL || "").trim(), source: "URL" },
    { value: (process.env.NEXT_PUBLIC_SITE_URL || "").trim(), source: "NEXT_PUBLIC_SITE_URL" },
  ];
  for (const item of candidates) {
    if (!item.value) continue;
    try {
      const url = new URL(item.value);
      if (!url.protocol.startsWith("http")) continue;
      return { hostOrigin: url.origin, source: item.source };
    } catch {
      continue;
    }
  }
  return {
    hostOrigin: null,
    source: "none",
    reason:
      "No crawl host resolved (pass request origin, or set DEPLOY_PRIME_URL / URL / NEXT_PUBLIC_SITE_URL). Auto-baseline skipped - not faked.",
  };
}

export function initialBaselineAutomation(
  hostOrigin: string | null,
  reason?: string
): ClientBaselineAutomation {
  if (!hostOrigin) {
    return {
      status: "missing",
      reason: reason || "No host origin available for preview crawl.",
      stale: false,
    };
  }
  return {
    status: "pending",
    reason: "Queued for automatic capture against client preview.",
    hostOrigin,
    stale: false,
  };
}

export function applyBaselineCaptureResult(
  current: ClientBaselineAutomation | undefined,
  result: {
    limited: boolean;
    pagesOk: number;
    pagesTotal: number;
    baselineId: string;
    capturedAt: string;
    hostOrigin?: string;
  }
): ClientBaselineAutomation {
  return {
    status: result.limited ? "limited" : "captured",
    reason: result.limited
      ? `Baseline stored but limited (${result.pagesOk}/${result.pagesTotal} OK). Preview may be down or thin.`
      : `Auto-captured ${result.pagesOk}/${result.pagesTotal} pages OK.`,
    capturedAt: result.capturedAt,
    pagesOk: result.pagesOk,
    pagesTotal: result.pagesTotal,
    baselineId: result.baselineId,
    stale: false,
    lastAttemptAt: result.capturedAt,
    hostOrigin: result.hostOrigin || current?.hostOrigin,
  };
}

export function applyBaselineFailure(
  current: ClientBaselineAutomation | undefined,
  err: string,
  hostOrigin?: string | null
): ClientBaselineAutomation {
  const now = new Date().toISOString();
  if (!hostOrigin && !current?.hostOrigin) {
    return {
      status: "missing",
      reason: err,
      lastAttemptAt: now,
      stale: current?.stale || false,
    };
  }
  return {
    ...(current || { status: "failed" as const }),
    status: "failed",
    reason: err,
    lastAttemptAt: now,
    hostOrigin: hostOrigin || current?.hostOrigin,
    stale: current?.stale || false,
  };
}

export function markBaselineStale(
  current: ClientBaselineAutomation | undefined,
  reason: string
): ClientBaselineAutomation {
  const base = current || {
    status: "stale" as const,
    stale: true,
  };
  return {
    ...base,
    status: current?.status === "missing" ? "missing" : "stale",
    stale: true,
    reason,
  };
}

const AUTO_COMPLETE_STAGES: StageKey[] = [
  "research",
  "blueprint",
  "content_briefs",
  "content_drafting",
  "technical_seo",
];

const MANUAL_STAGES: StageKey[] = ["human_approval", "production_deployment"];

/**
 * Advance stages when their data already exists. Never auto-completes
 * human_approval or production_deployment.
 */
export function applyAutoStageProgression(
  stages: FactoryStage[],
  opts: {
    hasResearchNotes?: boolean;
    blueprintCount: number;
    briefCount: number;
    draftedPageCount: number;
    baselineStatus?: ClientBaselineAutoStatus;
  }
): FactoryStage[] {
  const now = new Date().toISOString();
  return stages.map((stage) => {
    if (MANUAL_STAGES.includes(stage.key)) return stage;
    if (!AUTO_COMPLETE_STAGES.includes(stage.key)) return stage;
    // Do not downgrade operator-approved/complete work.
    if (stage.status === "approved" || stage.status === "complete") return stage;

    let next: StageStatus | null = null;
    let notes = stage.notes;

    if (stage.key === "research" && opts.hasResearchNotes !== false) {
      next = "complete";
      notes =
        notes ||
        "Auto: research notes seeded from intake config. Competitor URLs still manual without a search provider.";
    } else if (stage.key === "blueprint" && opts.blueprintCount > 0) {
      next = "complete";
      notes = notes || `Auto: blueprint seeded (${opts.blueprintCount} pages).`;
    } else if (stage.key === "content_briefs" && opts.briefCount > 0) {
      next = "ready_for_review";
      notes =
        notes ||
        `Auto: ${opts.briefCount} brief(s) seeded. Approve after competitorUrls / facts review.`;
    } else if (stage.key === "content_drafting" && opts.draftedPageCount > 0) {
      next = "ready_for_review";
      notes =
        notes ||
        `Auto: ${opts.draftedPageCount} draft page(s) seeded (templated, noindex). Operator must edit real facts.`;
    } else if (stage.key === "technical_seo") {
      if (opts.baselineStatus === "captured") {
        next = "complete";
        notes = notes || "Auto: client baseline captured with OK pages.";
      } else if (opts.baselineStatus === "limited") {
        next = "ready_for_review";
        notes = notes || "Auto: baseline exists but limited - review / recapture.";
      } else if (opts.baselineStatus === "pending" || opts.baselineStatus === "stale") {
        next = "in_progress";
        notes = notes || `Auto: baseline ${opts.baselineStatus}.`;
      }
    }

    if (!next || next === stage.status) return stage;
    return {
      ...stage,
      status: next,
      notes,
      completedAt: next === "complete" ? now : stage.completedAt,
    };
  });
}

export function countDraftedPages(pages: FactoryPage[]): number {
  return pages.filter((page) => Boolean(page.body && page.body.trim()) && page.status !== "planned")
    .length;
}

export function defaultClientAutomation(partial?: Partial<ClientAutomationState>): ClientAutomationState {
  return {
    baseline: partial?.baseline || initialBaselineAutomation(null, "Not queued yet."),
    drafts: partial?.drafts || { seeded: false, pageCount: 0 },
    competitors: partial?.competitors || competitorAutomationStatus(),
    stagesAutoAppliedAt: partial?.stagesAutoAppliedAt,
  };
}

/** Thin CRM projects that still need init-client-factory. */
export function projectNeedsFactoryBackfill(project: {
  id: string;
  factoryWorkspaceId?: string;
}): boolean {
  return !String(project.factoryWorkspaceId || "").trim();
}

export function selectBackfillProjectIds(
  projects: Array<{ id: string; factoryWorkspaceId?: string }>
): string[] {
  return projects.filter(projectNeedsFactoryBackfill).map((project) => project.id);
}

/** In-memory debounce for auto-recapture (at most one pending run per project). */
const pendingRecapture = new Map<string, ReturnType<typeof setTimeout>>();
const RECAPTURE_DEBOUNCE_MS = 1500;

export function clearRecaptureDebounce(projectId?: string): void {
  if (projectId) {
    const handle = pendingRecapture.get(projectId);
    if (handle) clearTimeout(handle);
    pendingRecapture.delete(projectId);
    return;
  }
  for (const handle of pendingRecapture.values()) clearTimeout(handle);
  pendingRecapture.clear();
}

/**
 * Schedule work after the HTTP response when Next `after()` is available;
 * otherwise fire-and-forget with error logging. Never throws to the caller.
 */
export function scheduleAfterResponse(label: string, task: () => Promise<void>): void {
  const run = () =>
    task().catch((err) => {
      console.error(`[client-automation] ${label} failed:`, err);
    });
  try {
    // Lazy require so unit tests that never touch Next still load this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("next/server") as { after?: (fn: () => void | Promise<void>) => void };
    if (typeof mod.after === "function") {
      mod.after(run);
      return;
    }
  } catch {
    // outside Next request / after unavailable
  }
  void run();
}

export function scheduleDebounced(
  projectId: string,
  label: string,
  task: () => Promise<void>,
  delayMs = RECAPTURE_DEBOUNCE_MS
): void {
  const existing = pendingRecapture.get(projectId);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    pendingRecapture.delete(projectId);
    scheduleAfterResponse(label, task);
  }, delayMs);
  pendingRecapture.set(projectId, handle);
}

export function syncAutomationOnWorkspace(
  workspace: FactoryWorkspace,
  patch: Partial<ClientAutomationState>
): FactoryWorkspace {
  const current = workspace.clientAutomation || defaultClientAutomation();
  const next: ClientAutomationState = {
    baseline: patch.baseline || current.baseline,
    drafts: patch.drafts || current.drafts,
    competitors: patch.competitors || competitorAutomationStatus(workspace.briefs),
    stagesAutoAppliedAt: patch.stagesAutoAppliedAt || current.stagesAutoAppliedAt,
  };
  workspace.clientAutomation = next;
  return workspace;
}

/** Persist baseline automation status on the client workspace. */
export async function persistBaselineAutomation(
  projectId: string,
  baseline: ClientBaselineAutomation,
  stageOpts?: { refreshStages?: boolean }
): Promise<FactoryWorkspace> {
  const { updateClientWorkspace } = await import("./client-workspace");
  return updateClientWorkspace(projectId, (workspace) => {
    const current = workspace.clientAutomation || defaultClientAutomation();
    workspace.clientAutomation = {
      ...current,
      baseline,
      competitors: competitorAutomationStatus(workspace.briefs),
    };
    if (stageOpts?.refreshStages) {
      workspace.stages = applyAutoStageProgression(workspace.stages, {
        hasResearchNotes: true,
        blueprintCount: workspace.blueprint.length,
        briefCount: workspace.briefs.length,
        draftedPageCount: countDraftedPages(workspace.pages),
        baselineStatus: baseline.status,
      });
      workspace.clientAutomation.stagesAutoAppliedAt = new Date().toISOString();
    }
    workspace.visibleGaps = workspace.visibleGaps.map((gap) =>
      gap.id === "client-baseline"
        ? {
            ...gap,
            status:
              baseline.status === "captured"
                ? "done"
                : baseline.status === "limited"
                  ? "open"
                  : "open",
            detail:
              baseline.reason ||
              `Baseline status: ${baseline.status}`,
          }
        : gap
    );
    return workspace;
  });
}

/**
 * Run captureClientBaseline and persist automation status.
 * Safe to call from after()/background - errors become status=failed.
 */
export async function runAutoClientBaseline(
  projectId: string,
  hostOriginHint?: string | null
): Promise<ClientBaselineAutomation> {
  const resolved = resolveAutomationHostOrigin(hostOriginHint);
  if (!resolved.hostOrigin) {
    const missing = initialBaselineAutomation(null, resolved.reason);
    try {
      await persistBaselineAutomation(projectId, missing, { refreshStages: true });
    } catch (err) {
      console.error("[client-automation] persist missing baseline status failed:", err);
    }
    return missing;
  }

  await persistBaselineAutomation(
    projectId,
    {
      status: "pending",
      reason: `Capturing against ${resolved.hostOrigin} (via ${resolved.source})`,
      hostOrigin: resolved.hostOrigin,
      stale: false,
      lastAttemptAt: new Date().toISOString(),
    },
    { refreshStages: true }
  );

  try {
    const { captureClientBaseline } = await import("./client-baseline");
    const result = await captureClientBaseline({
      projectId,
      hostOrigin: resolved.hostOrigin,
    });
    const next = applyBaselineCaptureResult(undefined, {
      limited: result.limited,
      pagesOk: result.pagesOk,
      pagesTotal: result.pagesTotal,
      baselineId: result.snapshot.id,
      capturedAt: result.snapshot.capturedAt,
      hostOrigin: resolved.hostOrigin,
    });
    await persistBaselineAutomation(projectId, next, { refreshStages: true });
    return next;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Client baseline capture failed.";
    const failed = applyBaselineFailure(undefined, message, resolved.hostOrigin);
    try {
      await persistBaselineAutomation(projectId, failed, { refreshStages: true });
    } catch (persistErr) {
      console.error("[client-automation] persist failed baseline status failed:", persistErr);
    }
    console.error("[client-automation] auto baseline failed:", message);
    return failed;
  }
}

/** Queue auto baseline after init/intake without blocking the caller. */
export function queueAutoClientBaseline(
  projectId: string,
  hostOriginHint?: string | null
): void {
  scheduleAfterResponse(`auto-baseline:${projectId}`, () =>
    runAutoClientBaseline(projectId, hostOriginHint).then(() => undefined)
  );
}

/**
 * Mark baseline stale when drafts/design/template change, then debounce recapture.
 */
export async function markStaleAndQueueRecapture(
  projectId: string,
  reason: string,
  hostOriginHint?: string | null
): Promise<FactoryWorkspace | null> {
  const { readClientWorkspace } = await import("./client-workspace");
  const existing = await readClientWorkspace(projectId);
  if (!existing) return null;
  const current = existing.clientAutomation?.baseline;
  const stale = markBaselineStale(current, reason);
  const workspace = await persistBaselineAutomation(projectId, stale, { refreshStages: true });
  const hint = hostOriginHint || stale.hostOrigin || current?.hostOrigin || null;
  scheduleDebounced(projectId, `auto-recapture:${projectId}`, () =>
    runAutoClientBaseline(projectId, hint).then(() => undefined)
  );
  return workspace;
}

export type BackfillResult = {
  scanned: number;
  initialized: number;
  skipped: number;
  errors: Array<{ projectId: string; error: string }>;
  projectIds: string[];
};

/** Idempotent: init-client-factory for CRM projects lacking factoryWorkspaceId. */
export async function backfillClientFactories(opts?: {
  hostOrigin?: string | null;
  projectIds?: string[];
}): Promise<BackfillResult> {
  const { listProjects, findProjectById, updateProject } = await import("@/lib/store");
  const { buildClientConfig, applyConfigToProject } = await import("./client-config");
  const { initClientWorkspace } = await import("./client-workspace");

  const all = await listProjects();
  const targets = opts?.projectIds?.length
    ? (
        await Promise.all(opts.projectIds.map((id) => findProjectById(id)))
      ).filter(Boolean)
    : all.filter((project) => projectNeedsFactoryBackfill(project));

  const result: BackfillResult = {
    scanned: opts?.projectIds?.length ? opts.projectIds.length : all.length,
    initialized: 0,
    skipped: 0,
    errors: [],
    projectIds: [],
  };

  for (const project of targets) {
    if (!project) continue;
    if (!projectNeedsFactoryBackfill(project) && project.factoryWorkspaceId) {
      // Still ensure workspace exists when id is set but doc missing? Keep strict: skip if id set.
      result.skipped += 1;
      continue;
    }
    try {
      const config = buildClientConfig({
        name: project.businessName || project.label,
        email: project.email || "",
        niche: project.niche || "",
        businessType: project.businessType || "",
        city: project.city || "",
        state: project.state || "",
        phone: project.phone || "",
        primaryGoal: project.primaryGoal || "",
        notes: project.notes || "",
        monitoringInterest: project.monitoringInterest,
        designStyleId: project.designStyleId || "",
        templateId: project.templateId || "",
        label: project.label,
        source: project.source,
      });
      const patched = applyConfigToProject(project, config);
      await updateProject(project.id, {
        businessName: patched.businessName,
        email: patched.email,
        niche: patched.niche,
        businessType: patched.businessType,
        city: patched.city,
        state: patched.state,
        phone: patched.phone,
        primaryGoal: patched.primaryGoal,
        notes: patched.notes,
        designStyleId: patched.designStyleId,
        templateId: patched.templateId,
        seededPages: patched.seededPages,
        factoryWorkspaceId: project.id,
        monitoringInterest: patched.monitoringInterest,
      });
      const init = await initClientWorkspace(project.id, config, {
        hostOrigin: opts?.hostOrigin,
      });
      if (init.created) {
        result.initialized += 1;
        result.projectIds.push(project.id);
        queueAutoClientBaseline(project.id, opts?.hostOrigin);
      } else {
        result.skipped += 1;
      }
    } catch (err) {
      result.errors.push({
        projectId: project.id,
        error: err instanceof Error ? err.message : "backfill failed",
      });
    }
  }
  return result;
}
