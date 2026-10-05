import path from "node:path";
import { unstable_rethrow } from "next/navigation";
import {
  StoreError,
  isStoreConflict,
  listDocKeys,
  readBinary,
  readDoc,
  writeBinary,
  writeDoc,
} from "@/lib/persistence";
import { newId } from "@/lib/store";
import {
  BLUEPRINT,
  CLUSTERS,
  SEED_BRIEFS,
  STAGE_DEFS,
  createProject,
  draftPagesFromBriefs,
  emptyStage,
} from "./pipeline";
import type {
  BaselineSnapshot,
  FactoryWorkspace,
  IndexingRecord,
  StageKey,
  StudyCheckpoint,
  VisibleGap,
} from "./types";
import { FACTORY_PROJECT_ID } from "./types";

/**
 * Durable keys (lib/persistence.ts): Netlify Blobs on Netlify (staging and production use
 * separate stores, same as leads), local files under data/ in development:
 *   factory/workspace            -> data/factory/workspace.json
 *   factory/baselines/<id>       -> data/factory/baselines/<id>.json
 *   factory/screenshots/<file>   -> data/factory/screenshots/<file> (binary)
 */
export const WORKSPACE_KEY = "factory/workspace";
export const BASELINE_PREFIX = "factory/baselines/";
export const SCREENSHOT_PREFIX = "factory/screenshots/";

const SAFE_ID = /^[a-z0-9_-]{1,80}$/i;
// One winner per round when several instances write at once, so allow enough rounds for a burst of ~20.
const MAX_UPDATE_ATTEMPTS = 30;

/** Serialises updateWorkspace calls inside one process so they never conflict with each other. */
let updateChain: Promise<unknown> = Promise.resolve();

/** Code-default workspace used until the first successful write; cached so the seed is stable per process. */
let seedCache: FactoryWorkspace | null = null;

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function seedIndexing(): IndexingRecord[] {
  const paths = new Set<string>(["/", ...BLUEPRINT.map((page) => page.path)]);
  return [...paths].map((pagePath) => ({
    path: pagePath,
    url: `https://sitesinc.co${pagePath === "/" ? "" : pagePath}`,
    state: "not_submitted" as const,
    lastChecked: "",
    source: "none",
    notes: "Submission does not guarantee indexing. Status is verified, never assumed.",
  }));
}

function seedCheckpoints(startedAt: string): StudyCheckpoint[] {
  return [
    {
      day: 0,
      label: "Day 0 — baseline",
      dueDate: startedAt,
      status: "scheduled",
      capturedAt: "",
      notes: "Capture live production before any factory pages go public.",
      evidence: [],
    },
    {
      day: 30,
      label: "Day 30 — first recrawl",
      dueDate: addDays(startedAt, 30),
      status: "scheduled",
      capturedAt: "",
      notes: "Re-run baseline + indexing check. Compare titles, index states, conversions.",
      evidence: [],
    },
    {
      day: 60,
      label: "Day 60 — mid-study",
      dueDate: addDays(startedAt, 60),
      status: "scheduled",
      capturedAt: "",
      notes: "Document any earned backlinks and Search Console changes. No invented metrics.",
      evidence: [],
    },
    {
      day: 90,
      label: "Day 90 — study close",
      dueDate: addDays(startedAt, 90),
      status: "scheduled",
      capturedAt: "",
      notes: "Final dated snapshot. Case study after-state uses this evidence only.",
      evidence: [],
    },
  ];
}

function seedGaps(): VisibleGap[] {
  return [
    {
      id: "gsc-api",
      area: "Indexing",
      owner: "operator",
      status: "open",
      detail:
        "Search Console URL Inspection runs only when GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN and GOOGLE_SEARCH_CONSOLE_SITE_URL are set. Until then, states stay submitted/not_submitted — never ‘indexed’.",
    },
    {
      id: "lighthouse",
      area: "Performance",
      owner: "operator",
      status: "open",
      detail: "Lab Lighthouse scores are not automated. Upload mobile/desktop screenshots and treat scores as in progress.",
    },
    {
      id: "netlify-deploy",
      area: "Production",
      owner: "operator",
      status: "open",
      detail:
        "Factory ‘publish’ writes routes in this repo. The live Netlify site updates only after an approved deploy. Homepage is never auto-replaced.",
    },
    {
      id: "backlink-outreach",
      area: "Authority",
      owner: "operator",
      status: "open",
      detail: "No automated link building. Record a backlink only after it is actually live and relevant.",
    },
    {
      id: "day-30-90",
      area: "Living study",
      owner: "operator",
      status: "open",
      detail: "Day 30 / 60 / 90 recaptures are scheduled in the workspace. The case study stays in progress until those dated snapshots exist.",
    },
  ];
}

export function seedWorkspace(): FactoryWorkspace {
  const startedAt = new Date().toISOString();
  return {
    project: { ...createProject(), createdAt: startedAt },
    stages: STAGE_DEFS.map((def) => emptyStage(def)),
    clusters: CLUSTERS,
    blueprint: BLUEPRINT,
    briefs: SEED_BRIEFS,
    pages: draftPagesFromBriefs(SEED_BRIEFS),
    indexing: seedIndexing(),
    backlinks: [],
    conversions: {
      lastRun: "",
      checks: [],
      events: [],
      launchBlocking: false,
    },
    deployments: [],
    screenshots: [],
    intakeProjects: [],
    study: {
      startedAt,
      horizonDays: 90,
      checkpoints: seedCheckpoints(startedAt),
    },
    visibleGaps: seedGaps(),
    latestBaselineId: "",
    latestBaselineBySite: {},
    productionLive: true,
    rollbackOf: "",
    productionRelease: {
      selected: [],
      approvedBy: "",
      approvedAt: "",
      notes: "",
      homepageReplaced: false,
    },
  };
}

function withDefaults(workspace: FactoryWorkspace): FactoryWorkspace {
  const seeded = seedWorkspace();
  return {
    ...seeded,
    ...workspace,
    intakeProjects: workspace.intakeProjects || [],
    study: workspace.study || seeded.study,
    visibleGaps: workspace.visibleGaps?.length ? workspace.visibleGaps : seeded.visibleGaps,
    screenshots: workspace.screenshots || [],
    productionRelease: workspace.productionRelease || seeded.productionRelease,
    latestBaselineBySite: workspace.latestBaselineBySite || {},
  };
}

type LoadedWorkspace = {
  workspace: FactoryWorkspace;
  /** Store version of the persisted document; null while the store has no workspace yet (seed only). */
  version: string | null;
};

async function loadWorkspace(): Promise<LoadedWorkspace> {
  const doc = await readDoc<FactoryWorkspace>(WORKSPACE_KEY);
  if (doc) {
    if (doc.value?.project?.id !== FACTORY_PROJECT_ID) {
      // Never reseed over data we do not understand: that would silently destroy it on the next write.
      throw new StoreError(
        "corrupt",
        "Stored factory workspace has an unexpected project id; refusing to overwrite it."
      );
    }
    return { workspace: withDefaults(doc.value), version: doc.version };
  }
  // Fresh store: serve code defaults. Nothing is written on read; the seed is persisted by the first write.
  if (!seedCache) seedCache = seedWorkspace();
  return { workspace: structuredClone(seedCache), version: null };
}

export async function readWorkspace(): Promise<FactoryWorkspace> {
  return (await loadWorkspace()).workspace;
}

export const ensureWorkspace = readWorkspace;

/** Workspace plus whether a document is actually persisted (false = code-default seed only). */
export async function readWorkspaceState(): Promise<{ workspace: FactoryWorkspace; persisted: boolean }> {
  const { workspace, version } = await loadWorkspace();
  return { workspace, persisted: version !== null };
}

/**
 * Public-page reader: never throws. A store outage or corrupt document is logged and null is returned
 * so public pages can degrade (notFound / placeholder) instead of answering 500. /app pages keep using
 * readWorkspace(), which stays strict.
 */
export async function readPublicWorkspace(): Promise<FactoryWorkspace | null> {
  try {
    return await readWorkspace();
  } catch (err) {
    unstable_rethrow(err);
    const kind = err instanceof StoreError ? err.kind : "unknown";
    console.error(`Public page: factory workspace unavailable (${kind}); serving fallback.`);
    return null;
  }
}

/** Public /case-study data: workspace + latest baseline, or null when the store cannot serve them. */
export async function readPublicCaseStudy(): Promise<{
  workspace: FactoryWorkspace;
  baseline: BaselineSnapshot | null;
} | null> {
  try {
    const workspace = await readWorkspace();
    const baseline = await latestBaseline();
    return { workspace, baseline };
  } catch (err) {
    unstable_rethrow(err);
    const kind = err instanceof StoreError ? err.kind : "unknown";
    console.error(`Public /case-study: factory state unavailable (${kind}); serving fallback.`);
    return null;
  }
}

/** Small, secret-free workspace health used by /api/health. */
export async function workspaceHealth(): Promise<"ok" | "not_initialized" | "corrupt" | "unreadable"> {
  try {
    const { persisted } = await readWorkspaceState();
    return persisted ? "ok" : "not_initialized";
  } catch (err) {
    return err instanceof StoreError && err.kind === "corrupt" ? "corrupt" : "unreadable";
  }
}

/**
 * Persist the code-default workspace (create-only) so the store is "initialized": after this the public
 * intake mirror starts writing. Does nothing (created:false) when a workspace already exists, and fails
 * loudly if the stored document is corrupt. Operator action `init-workspace`.
 */
export async function initWorkspace(): Promise<{ created: boolean; workspace: FactoryWorkspace }> {
  const { workspace, version } = await loadWorkspace();
  if (version !== null) return { created: false, workspace };
  try {
    await writeDoc(WORKSPACE_KEY, workspace, { expectedVersion: null });
    return { created: true, workspace };
  } catch (err) {
    if (isStoreConflict(err)) return { created: false, workspace: (await loadWorkspace()).workspace };
    throw err;
  }
}

/** Unconditional (last write wins) write of the whole workspace. Throws if the store rejects it. */
export async function writeWorkspace(workspace: FactoryWorkspace): Promise<void> {
  await writeDoc(WORKSPACE_KEY, workspace);
}

/**
 * Read-modify-write with optimistic concurrency: the write only succeeds if the stored
 * document is unchanged since it was read (ETag on Blobs, content hash locally). On a
 * conflict (another instance wrote first) the mutation is re-applied to the fresh copy, up to
 * MAX_UPDATE_ATTEMPTS times. Calls inside one process are queued. Write failures are thrown, never swallowed.
 */
export async function updateWorkspace(
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void
): Promise<FactoryWorkspace> {
  return (await queueUpdate(mutate, false)) as FactoryWorkspace;
}

/**
 * Like updateWorkspace, but only when a workspace document is already persisted. On an uninitialized
 * store it writes NOTHING and returns null (so an unattended writer, e.g. the public intake mirror,
 * can never create the code-default seed ahead of a migration).
 */
export function updateExistingWorkspace(
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void
): Promise<FactoryWorkspace | null> {
  return queueUpdate(mutate, true);
}

function queueUpdate(
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void,
  requireExisting: boolean
): Promise<FactoryWorkspace | null> {
  const run = updateChain.then(() => applyUpdate(mutate, requireExisting));
  updateChain = run.catch(() => undefined);
  return run;
}

async function applyUpdate(
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void,
  requireExisting: boolean
): Promise<FactoryWorkspace | null> {
  for (let attempt = 1; ; attempt += 1) {
    const { workspace, version } = await loadWorkspace();
    if (requireExisting && version === null) return null;
    const next = mutate(workspace) || workspace;
    try {
      await writeDoc(WORKSPACE_KEY, next, { expectedVersion: version });
      return next;
    } catch (err) {
      if (isStoreConflict(err) && attempt < MAX_UPDATE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(20 * attempt, 150) + Math.floor(Math.random() * 40)));
        continue;
      }
      throw err;
    }
  }
}

function baselineKey(id: string): string {
  if (!SAFE_ID.test(id)) throw new StoreError("write", "Invalid baseline id.");
  return `${BASELINE_PREFIX}${id}`;
}

export async function saveBaseline(snapshot: BaselineSnapshot): Promise<void> {
  await writeDoc(baselineKey(snapshot.id), snapshot);
}

export type BaselineWarning = { key: string; problem: "corrupt" | "invalid"; message: string };

function looksLikeBaseline(value: unknown): value is BaselineSnapshot {
  const row = value as Partial<BaselineSnapshot> | null;
  return Boolean(
    row &&
      typeof row === "object" &&
      typeof row.id === "string" &&
      typeof row.capturedAt === "string" &&
      Array.isArray(row.pageInventory)
  );
}

/** Reads one baseline; a corrupt/invalid one is reported (never silently dropped) and skipped. */
async function readBaselineChecked(
  key: string
): Promise<{ snapshot: BaselineSnapshot | null; warning?: BaselineWarning }> {
  try {
    const value = (await readDoc<BaselineSnapshot>(key))?.value ?? null;
    if (value === null) return { snapshot: null };
    if (!looksLikeBaseline(value)) {
      const message = "Baseline document is not a valid snapshot; skipped.";
      console.error(`Skipping invalid baseline ${key}: ${message}`);
      return { snapshot: null, warning: { key, problem: "invalid", message } };
    }
    return { snapshot: value };
  } catch (err) {
    // One corrupt baseline must not take down every SEO page; real I/O failures still throw.
    if (err instanceof StoreError && err.kind === "corrupt") {
      console.error(`Skipping unreadable baseline ${key}: ${err.message}`);
      return { snapshot: null, warning: { key, problem: "corrupt", message: err.message } };
    }
    throw err;
  }
}

export async function readBaseline(id: string): Promise<BaselineSnapshot | null> {
  if (!SAFE_ID.test(id)) return null;
  return (await readBaselineChecked(baselineKey(id))).snapshot;
}

/** Baselines plus a warning for every stored baseline that had to be skipped (used by the export). */
export async function listBaselinesDetailed(): Promise<{
  baselines: BaselineSnapshot[];
  warnings: BaselineWarning[];
}> {
  const keys = await listDocKeys(BASELINE_PREFIX);
  const warnings: BaselineWarning[] = [];
  const rows = await Promise.all(
    keys.map(async (key) => {
      if (!SAFE_ID.test(key.slice(BASELINE_PREFIX.length))) {
        warnings.push({ key, problem: "invalid", message: "Unsafe baseline key; skipped." });
        return null;
      }
      const { snapshot, warning } = await readBaselineChecked(key);
      if (warning) warnings.push(warning);
      return snapshot;
    })
  );
  return {
    baselines: rows
      .filter((row): row is BaselineSnapshot => Boolean(row))
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    warnings,
  };
}

export async function listBaselines(): Promise<BaselineSnapshot[]> {
  return (await listBaselinesDetailed()).baselines;
}

export async function latestBaseline(): Promise<BaselineSnapshot | null> {
  const workspace = await readWorkspace();
  if (workspace.latestBaselineId) {
    const named = await readBaseline(workspace.latestBaselineId);
    if (named) return named;
  }
  const all = await listBaselines();
  return all.length ? all[all.length - 1] : null;
}

export function newFactoryId(prefix: string): string {
  return newId(prefix);
}

export async function recordEvent(
  type: FactoryWorkspace["conversions"]["events"][number]["type"],
  path: string,
  meta = ""
) {
  const { conversionEvent } = await import("./conversions");
  const event = conversionEvent(type, path, meta);
  await updateWorkspace((workspace) => {
    workspace.conversions.events = [event, ...workspace.conversions.events].slice(0, 400);
    return workspace;
  });
  return event;
}

export async function captureAndStoreBaseline(origin: string, siteId?: string): Promise<FactoryWorkspace> {
  const { captureBaseline } = await import("./crawl");
  const snapshot = await captureBaseline({ origin, siteId });
  await saveBaseline(snapshot);
  return updateWorkspace((workspace) => {
    const id = snapshot.siteId || siteId || workspace.project.id;
    workspace.latestBaselineBySite = { ...(workspace.latestBaselineBySite || {}), [id]: snapshot.id };
    if (id === FACTORY_PROJECT_ID || (origin.includes("sitesinc.co") && !origin.includes("/demo/"))) {
      workspace.latestBaselineId = snapshot.id;
    }
    return workspace;
  });
}

export async function getFactoryPayload() {
  const { buildPreflight } = await import("./preflight");
  const { DISCLAIMERS } = await import("./pipeline");
  const workspace = await readWorkspace();
  const baseline = await latestBaseline();
  const baselines = (await listBaselines()).map((row) => ({
    id: row.id,
    capturedAt: row.capturedAt,
    origin: row.origin,
    source: row.source,
    pages: row.pageInventory.length,
  }));
  return {
    workspace,
    baseline,
    baselines,
    preflight: buildPreflight(workspace, baseline),
    disclaimers: DISCLAIMERS,
  };
}

export async function saveScreenshot(input: {
  name: string;
  bytes: Buffer;
  viewport: "desktop" | "mobile";
  label: string;
}) {
  const ext = path.extname(input.name).toLowerCase() || ".png";
  const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
  const id = newId("shot");
  const filename = `${id}${safeExt}`;
  await writeBinary(`${SCREENSHOT_PREFIX}${filename}`, input.bytes, SCREENSHOT_TYPES[safeExt]);
  const ref = {
    id,
    viewport: input.viewport,
    label: input.label || `${input.viewport} screenshot`,
    url: `/api/factory/files/${filename}`,
    uploadedAt: new Date().toISOString(),
  };
  await updateWorkspace((workspace) => {
    workspace.screenshots = [ref, ...workspace.screenshots].slice(0, 40);
    workspace.visibleGaps = workspace.visibleGaps.map((gap) =>
      gap.id === "lighthouse" && input.viewport === "mobile"
        ? { ...gap, detail: `${gap.detail} Mobile screenshot ${ref.id} attached ${ref.uploadedAt}.` }
        : gap
    );
    return workspace;
  });
  return ref;
}

const SCREENSHOT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Read an uploaded screenshot by file name. Null when it does not exist. */
export async function readScreenshot(name: string): Promise<Buffer | null> {
  if (!/^[a-z0-9_.-]+$/i.test(name) || name.includes("..")) return null;
  return readBinary(`${SCREENSHOT_PREFIX}${name}`);
}

export async function patchStage(input: {
  key: StageKey;
  status?: string;
  notes?: string;
  approve?: boolean;
  approvedBy?: string;
}) {
  const { applyFactoryAction } = await import("./actions");
  if (input.approve) {
    return applyFactoryAction("approve-stage", {
      key: input.key,
      notes: input.notes,
      approvedBy: input.approvedBy,
    });
  }
  return applyFactoryAction("complete-stage", {
    key: input.key,
    notes: input.notes,
    approvedBy: input.approvedBy,
  });
}

export async function patchBrief(input: {
  id: string;
  status?: string;
  notes?: string;
  approvedBy?: string;
}) {
  const { applyFactoryAction } = await import("./actions");
  if (input.status === "approved") {
    return applyFactoryAction("approve-brief", { id: input.id, approvedBy: input.approvedBy });
  }
  return { ok: false, error: "Only brief approval is supported from this endpoint." };
}

export async function patchPage(input: {
  slug: string;
  title?: string;
  metaDescription?: string;
  body?: string;
  status?: string;
  approvedBy?: string;
}) {
  if (input.status === "approved") {
    const { applyFactoryAction } = await import("./actions");
    return applyFactoryAction("approve-page", { slug: input.slug, approvedBy: input.approvedBy });
  }
  return updateWorkspace((workspace) => {
    workspace.pages = workspace.pages.map((page) =>
      page.slug === input.slug
        ? {
            ...page,
            title: input.title || page.title,
            metaDescription: input.metaDescription || page.metaDescription,
            body: typeof input.body === "string" ? input.body : page.body,
          }
        : page
    );
    return workspace;
  });
}

export async function deployStaging(approvedBy: string, notes?: string) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("stage-pages", { approvedBy, notes });
}

export async function deployProduction(approvedBy: string, notes?: string) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("publish-pages", { approvedBy, notes });
}

export async function rollbackProduction(approvedBy: string, notes?: string) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("rollback", { approvedBy, notes });
}

export async function patchIndexing(input: { path: string; state?: string; notes?: string }) {
  const { gscConfigured } = await import("./search-console");
  if (input.state === "indexed" && !gscConfigured()) {
    throw new Error("Cannot mark a URL indexed without Search Console verification.");
  }
  return updateWorkspace((workspace) => {
    workspace.indexing = workspace.indexing.map((row) =>
      row.path === input.path
        ? {
            ...row,
            state: (input.state as typeof row.state) || row.state,
            notes: input.notes || row.notes,
            lastChecked: new Date().toISOString(),
            source: input.state === "indexed" ? "search_console" : row.source || "operator",
          }
        : row
    );
    return workspace;
  });
}

export async function addBacklink(input: {
  referringDomain: string;
  destinationUrl: string;
  anchor?: string;
  relevance?: string;
  qualityNotes?: string;
  acquisitionMethod?: string;
  discoveredDate?: string;
  status?: string;
}) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("add-backlink", {
    referringDomain: input.referringDomain,
    destinationUrl: input.destinationUrl,
    anchor: input.anchor,
    relevance: input.relevance,
    qualityNotes: input.qualityNotes,
    acquisitionMethod: input.acquisitionMethod,
  });
}

export async function patchBacklink(
  id: string,
  patch:
    | {
        status?: string;
        referringDomain?: string;
        destinationUrl?: string;
        anchor?: string;
        relevance?: string;
        qualityNotes?: string;
        acquisitionMethod?: string;
        discoveredDate?: string;
      }
    | string = {}
) {
  const fields = typeof patch === "string" ? { status: patch } : patch;
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("patch-backlink", {
    id,
    ...fields,
  });
}

export async function removeBacklink(id: string) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("remove-backlink", { id });
}

export async function runChecks(origin: string) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("run-conversions", { origin });
}

