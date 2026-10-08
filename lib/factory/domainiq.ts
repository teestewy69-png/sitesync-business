/**
 * DomainIQ bay for the per-client factory (server side).
 *
 * - Auto: on client setup (intake / init-client-factory / backfill), generate and
 *   store scored domain candidates via `after()` (same pattern as auto baseline),
 *   then run the optional keyless availability check on them.
 * - Manual by design: the operator picks a domain; Tony signs off on purchase.
 *   Sitesinc never buys, reserves, or registers a domain.
 */
import { findProjectById, listProjects, updateProject } from "@/lib/store";
import type { ClientDomainIQState, ClientProject } from "@/lib/store";
import { DOMAINIQ_ENGINE_VERSION, domainIQ } from "@/lib/domainiq";
import { availabilityCheckingEnabled, checkDomainsAvailability } from "@/lib/domainiq/availability";
import {
  applyAvailabilityResults,
  rankByVerifiedAvailability,
  selectCandidate,
  suggestClientDomains,
  type ClientDomainCandidate,
} from "@/lib/domainiq/client";
import { normalizeFullName } from "@/lib/domainiq/engine";
import { configFromProject } from "./client-config";
import { scheduleAfterResponse } from "./client-automation";

/** How many top candidates the manual "Check availability" button re-checks. */
export const AUTO_AVAILABILITY_LIMIT = 12;
/** Candidates stored per client. */
export const STORED_CANDIDATES = 12;
/** Ranked pool generated per pass (local + brand) so the availability pass can find unregistered names. */
const POOL_PER_PASS = 18;

/**
 * Generate a ranked DomainIQ pool and, when enabled, run the keyless availability
 * pass over all of it, surfacing verified-available names first.
 */
export async function discoverClientDomains(
  seed: { businessName: string; niche: string; city: string; state: string },
  opts: { checkAvailability?: boolean } = {}
) {
  const out = suggestClientDomains(domainIQ, seed, { localCount: POOL_PER_PASS, brandCount: POOL_PER_PASS });
  const enabled = availabilityCheckingEnabled() && opts.checkAvailability !== false;
  if (!out.ok || !enabled) {
    return { out, candidates: out.candidates.slice(0, STORED_CANDIDATES), availabilityChecked: 0, checkedAt: undefined };
  }
  const results = await checkDomainsAvailability(
    out.candidates.map((c) => c.domain),
    { concurrency: 8, timeoutMs: 4000 }
  );
  return {
    out,
    candidates: rankByVerifiedAvailability(out.candidates, results, { max: STORED_CANDIDATES, keepUnavailable: 4 }),
    availabilityChecked: results.length,
    checkedAt: new Date().toISOString(),
    counts: results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {}),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function baseState(project: ClientProject): ClientDomainIQState {
  return {
    ...(project.domainIQ || {}),
    engine: DOMAINIQ_ENGINE_VERSION,
    mode: "in-process",
    purchase: "manual",
  };
}

export function clientDomainSeedFromProject(project: ClientProject) {
  let config: ReturnType<typeof configFromProject> | null = null;
  try {
    config = configFromProject(project);
  } catch {
    config = null;
  }
  return {
    // Current client config first (normalized, never the raw intake label when a real name exists).
    businessName: config?.businessName || project.businessName || project.label || "",
    niche: config?.niche || project.niche || "",
    city: config?.city || project.city || "",
    state: config?.state || project.state || "",
  };
}

export type DomainRunResult = {
  ok: boolean;
  error?: string;
  skipped?: string;
  project?: ClientProject | null;
};

/**
 * Generate + store DomainIQ candidates for a client project.
 * Keeps an existing operator selection (and its candidate row) intact.
 */
export async function generateDomainCandidatesForProject(
  projectId: string,
  opts: { force?: boolean; checkAvailability?: boolean } = {}
): Promise<DomainRunResult> {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  if (!opts.force && project.domainCandidates?.length) {
    return { ok: true, skipped: "Candidates already exist (pass force to regenerate).", project };
  }
  if (!opts.force && project.domainStatus === "client_owned") {
    return { ok: true, skipped: `Client already owns ${project.selectedDomain || project.ownedDomain}; no suggestions needed.`, project };
  }

  const seed = clientDomainSeedFromProject(project);
  const state = baseState(project);
  let out: ReturnType<typeof suggestClientDomains>;
  try {
    out = suggestClientDomains(domainIQ, seed, { localCount: POOL_PER_PASS, brandCount: POOL_PER_PASS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DomainIQ generation failed.";
    const updated = await updateProject(projectId, {
      domainStatus: project.selectedDomain ? project.domainStatus : "failed",
      domainIQ: { ...state, reason: message, seed, generatedAt: nowIso() },
    });
    return { ok: false, error: message, project: updated };
  }

  if (!out.ok) {
    const updated = await updateProject(projectId, {
      domainStatus: project.selectedDomain ? project.domainStatus : "missing_input",
      domainIQ: { ...state, reason: out.reason, seed, generatedAt: nowIso() },
    });
    return { ok: false, error: out.reason, project: updated };
  }

  const selected = project.selectedDomain;
  const keepSelection = (list: ClientDomainCandidate[]) => {
    if (!selected || list.some((c) => c.domain === selected)) return list;
    const keep = project.domainCandidates?.find((c) => c.domain === selected);
    return keep ? [keep, ...list] : list;
  };
  const candidates = keepSelection(out.candidates.slice(0, STORED_CANDIDATES));

  const generatedAt = nowIso();
  const enabled = availabilityCheckingEnabled();
  // 1) Persist scored candidates immediately (unchecked) so a slow/failed lookup never loses them.
  let updated = await updateProject(projectId, {
    domainCandidates: candidates,
    domainStatus: selected ? project.domainStatus || "selected" : "candidates_ready",
    domainIQ: {
      ...state,
      generatedAt,
      reason: `DomainIQ generated ${candidates.length} scored candidates (${out.meta.nicheKey || "no niche"} profile, ${out.meta.resolutionSource}).`,
      seed,
      nicheKey: out.meta.nicheKey,
      resolutionSource: out.meta.resolutionSource,
      localKeywords: out.meta.localKeywords,
      availability: enabled
        ? { enabled: true, detail: "Queued: public RDAP + DNS (keyless)." }
        : { enabled: false, detail: "DOMAINIQ_AVAILABILITY=off - candidates stay unchecked." },
    },
  });

  // 2) Availability pass over the whole ranked pool (DomainIQ-style oversampling).
  if (enabled && opts.checkAvailability !== false) {
    try {
      const results = await checkDomainsAvailability(
        out.candidates.map((c) => c.domain),
        { concurrency: 8, timeoutMs: 4000 }
      );
      const ranked = keepSelection(
        rankByVerifiedAvailability(out.candidates, results, { max: STORED_CANDIDATES, keepUnavailable: 4 })
      );
      const counts = results.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      const fresh = (await findProjectById(projectId)) || project;
      updated = await updateProject(projectId, {
        domainCandidates: fresh.selectedDomain && fresh.selectedDomain !== selected
          ? keepSelectionFrom(fresh, ranked)
          : ranked,
        domainIQ: {
          ...baseState(fresh),
          availability: {
            enabled: true,
            checkedAt: nowIso(),
            checked: results.length,
            detail: `${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(", ")} across a ${out.candidates.length}-name ranked pool`,
          },
        },
      });
    } catch (err) {
      console.warn("[domainiq] availability pass failed:", err instanceof Error ? err.message : "unknown");
    }
  }
  return { ok: true, project: updated };
}

function keepSelectionFrom(project: ClientProject, list: ClientDomainCandidate[]): ClientDomainCandidate[] {
  const selected = project.selectedDomain;
  if (!selected || list.some((c) => c.domain === selected)) return list;
  const keep = project.domainCandidates?.find((c) => c.domain === selected);
  return keep ? [keep, ...list] : list;
}

/** Optional availability pass (public RDAP + DNS, no keys). Never reserves or buys. */
export async function checkProjectDomainAvailability(
  projectId: string,
  domains?: string[]
): Promise<DomainRunResult> {
  if (!availabilityCheckingEnabled()) {
    return { ok: false, error: "Availability checks disabled (DOMAINIQ_AVAILABILITY=off). Candidates stay unchecked." };
  }
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  const candidates = project.domainCandidates || [];
  if (!candidates.length) return { ok: false, error: "No domain candidates yet - generate first." };
  const targets = (domains?.length ? domains : candidates.slice(0, AUTO_AVAILABILITY_LIMIT).map((c) => c.domain))
    .map((d) => d.trim().toLowerCase())
    .filter((d) => candidates.some((c) => c.domain === d));
  const results = await checkDomainsAvailability(targets);
  // Re-read so a concurrent operator pick is not overwritten.
  const fresh = (await findProjectById(projectId)) || project;
  const merged = applyAvailabilityResults(fresh.domainCandidates || candidates, results);
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const updated = await updateProject(projectId, {
    domainCandidates: merged,
    domainIQ: {
      ...baseState(fresh),
      availability: {
        enabled: true,
        checkedAt: nowIso(),
        checked: results.length,
        detail: Object.entries(counts)
          .map(([status, n]) => `${n} ${status}`)
          .join(", "),
      },
    },
  });
  return { ok: true, project: updated };
}

/** Operator pick (or a domain the client already owns). Selecting is not buying. */
export async function selectProjectDomain(
  projectId: string,
  rawDomain: string,
  actor: string
): Promise<DomainRunResult> {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  let domain: string;
  try {
    domain = normalizeFullName(rawDomain);
  } catch {
    return { ok: false, error: `Not a valid domain: ${rawDomain}` };
  }
  let candidates: ClientDomainCandidate[] = project.domainCandidates || [];
  if (!candidates.some((c) => c.domain === domain)) {
    // Operator-typed domain: score it with DomainIQ under this client's niche context.
    const seed = clientDomainSeedFromProject(project);
    const ctx = domainIQ.scoreContextForNiche(seed.niche || "custom");
    const s = domainIQ.score(domain, ctx);
    const label = domain.slice(0, domain.lastIndexOf("."));
    candidates = [
      ...candidates,
      {
        domain,
        label,
        tld: domain.slice(domain.lastIndexOf(".") + 1),
        score: s.total,
        band: s.band,
        source: "operator",
        pattern: "operator",
        summary: s.summary,
        explanation: s.explanation,
        highlights: s.highlights,
        concerns: s.concerns,
        subScores: s.subScores,
        nicheKey: s.nicheKey,
        availability: "unchecked",
      },
    ];
  }
  const picked = selectCandidate(candidates, domain);
  if (!picked.ok) return { ok: false, error: picked.error };
  const updated = await updateProject(projectId, {
    domainCandidates: candidates,
    selectedDomain: picked.domain,
    domainStatus: "selected",
    domainIQ: {
      ...baseState(project),
      selectedBy: actor || "operator",
      selectedAt: nowIso(),
      selectionWarning: picked.warning,
      purchaseApprovedBy: undefined,
      purchaseApprovedAt: undefined,
    },
  });
  return { ok: true, project: updated };
}

export async function clearProjectDomainSelection(projectId: string): Promise<DomainRunResult> {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  const updated = await updateProject(projectId, {
    selectedDomain: undefined,
    ownedDomain: undefined,
    domainStatus: project.domainCandidates?.length ? "candidates_ready" : "pending",
    domainIQ: {
      ...baseState(project),
      selectedBy: undefined,
      selectedAt: undefined,
      selectionWarning: undefined,
      purchaseApprovedBy: undefined,
      purchaseApprovedAt: undefined,
    },
  });
  return { ok: true, project: updated };
}

/**
 * Record Tony's purchase sign-off for the selected domain. This is a human
 * approval record only - the purchase itself happens manually at a registrar.
 */
export async function approveDomainPurchase(projectId: string, approvedBy: string): Promise<DomainRunResult> {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  if (!project.selectedDomain) return { ok: false, error: "Select a domain before purchase sign-off." };
  const who = approvedBy.trim();
  if (!who) return { ok: false, error: "approvedBy required (Tony's sign-off)." };
  const updated = await updateProject(projectId, {
    domainStatus: "purchase_approved",
    domainIQ: { ...baseState(project), purchaseApprovedBy: who, purchaseApprovedAt: nowIso() },
  });
  return { ok: true, project: updated };
}

/** Queue automatic candidate generation after the HTTP response (after() / fire-and-forget). */
export function queueAutoDomainCandidates(projectId: string): void {
  scheduleAfterResponse(`auto-domainiq:${projectId}`, async () => {
    const result = await generateDomainCandidatesForProject(projectId);
    if (!result.ok) console.warn(`[domainiq] auto candidates for ${projectId}: ${result.error}`);
  });
}

/**
 * Record a domain the client already owns: it becomes the selected domain with status client_owned,
 * no purchase sign-off is needed, and automatic DomainIQ suggestions are skipped.
 * Never touches DNS, Netlify or a registrar.
 */
export async function recordClientOwnedDomain(
  projectId: string,
  domain: string,
  actor: string
): Promise<DomainRunResult> {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  let normalized: string;
  try {
    normalized = normalizeFullName(domain).replace(/^www\./, "");
  } catch {
    return { ok: false, error: `Not a valid domain: ${domain}` };
  }
  // Suggestions generated before the client said they own a domain are obsolete: clear them.
  // (Generate still works afterwards if the operator wants ideas.)
  const updated = await updateProject(projectId, {
    ownedDomain: normalized,
    selectedDomain: normalized,
    domainStatus: "client_owned",
    domainCandidates: [],
    domainIQ: {
      ...baseState(project),
      reason: `Client already owns ${normalized}. Domain suggestions are not auto-generated (Generate still works if you want ideas).`,
      selectedBy: actor || "client intake",
      selectedAt: nowIso(),
      selectionWarning: undefined,
      purchaseApprovedBy: undefined,
      purchaseApprovedAt: undefined,
    },
  });
  return { ok: true, project: updated };
}

/** Mark pending synchronously so the operator page shows the queued state honestly. */
export async function markDomainCandidatesPending(projectId: string): Promise<void> {
  const project = await findProjectById(projectId);
  if (!project || project.domainCandidates?.length || project.selectedDomain || project.ownedDomain) return;
  await updateProject(projectId, {
    domainStatus: "pending",
    domainIQ: { ...baseState(project), reason: "Queued for automatic DomainIQ generation." },
  });
}

export type DomainBackfillResult = { scanned: number; generated: number; skipped: number; errors: Array<{ projectId: string; error: string }> };

/** Idempotent: generate candidates for every client project that has none yet. */
export async function backfillDomainCandidates(): Promise<DomainBackfillResult> {
  const projects = await listProjects();
  const result: DomainBackfillResult = { scanned: projects.length, generated: 0, skipped: 0, errors: [] };
  for (const project of projects) {
    if (project.domainCandidates?.length) {
      result.skipped += 1;
      continue;
    }
    const run = await generateDomainCandidatesForProject(project.id, { checkAvailability: false });
    if (run.ok && !run.skipped) result.generated += 1;
    else if (run.ok) result.skipped += 1;
    else result.errors.push({ projectId: project.id, error: run.error || "failed" });
  }
  return result;
}

export type DomainBaySummary = {
  engine: string;
  mode: "in-process";
  availabilityEnabled: boolean;
  clients: number;
  withCandidates: number;
  pending: number;
  selected: number;
  purchaseApproved: number;
  needsInput: number;
  failed: number;
  rows: Array<{
    id: string;
    name: string;
    status: string;
    selectedDomain?: string;
    topDomain?: string;
    topScore?: number;
    candidates: number;
  }>;
};

export function summarizeDomainBay(projects: ClientProject[]): DomainBaySummary {
  const count = (status: string) => projects.filter((p) => p.domainStatus === status).length;
  return {
    engine: DOMAINIQ_ENGINE_VERSION,
    mode: "in-process",
    availabilityEnabled: availabilityCheckingEnabled(),
    clients: projects.length,
    withCandidates: projects.filter((p) => p.domainCandidates?.length).length,
    pending: count("pending") + projects.filter((p) => !p.domainStatus).length,
    selected: count("selected") + count("client_owned"),
    purchaseApproved: count("purchase_approved"),
    needsInput: count("missing_input"),
    failed: count("failed"),
    rows: projects.slice(0, 12).map((p) => ({
      id: p.id,
      name: p.businessName || p.label,
      status: p.domainStatus || "not_run",
      selectedDomain: p.selectedDomain,
      topDomain: p.domainCandidates?.[0]?.domain,
      topScore: p.domainCandidates?.[0]?.score,
      candidates: p.domainCandidates?.length || 0,
    })),
  };
}
