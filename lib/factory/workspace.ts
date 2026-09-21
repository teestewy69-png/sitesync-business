import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

const ROOT = path.join(process.cwd(), "data", "factory");
const WORKSPACE_FILE = path.join(ROOT, "workspace.json");
const BASELINE_DIR = path.join(ROOT, "baselines");

let writeChain: Promise<void> = Promise.resolve();

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
  };
}

export async function readWorkspace(): Promise<FactoryWorkspace> {
  try {
    const raw = await readFile(WORKSPACE_FILE, "utf8");
    const parsed = JSON.parse(raw) as FactoryWorkspace;
    if (parsed?.project?.id === FACTORY_PROJECT_ID) return withDefaults(parsed);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn("Factory workspace unreadable; reseeding", err);
    }
  }
  const seeded = seedWorkspace();
  try {
    await writeWorkspace(seeded);
  } catch (err) {
    console.warn(
      "Factory workspace file is not writable on this host; CRM records remain the source of truth.",
      err instanceof Error ? err.name : "unknown"
    );
  }
  return seeded;
}

export const ensureWorkspace = readWorkspace;

export async function writeWorkspace(workspace: FactoryWorkspace): Promise<void> {
  const run = writeChain.then(async () => {
    await mkdir(ROOT, { recursive: true });
    await writeFile(WORKSPACE_FILE, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
  });
  writeChain = run.catch(() => undefined);
  try {
    await run;
  } catch (err) {
    console.warn(
      "Factory workspace write skipped; CRM store is source of truth.",
      err instanceof Error ? err.name : "unknown"
    );
  }
}

export async function updateWorkspace(
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void
): Promise<FactoryWorkspace> {
  const current = await readWorkspace();
  const next = mutate(current) || current;
  await writeWorkspace(next);
  return next;
}

export async function saveBaseline(snapshot: BaselineSnapshot): Promise<void> {
  await mkdir(BASELINE_DIR, { recursive: true });
  await writeFile(
    path.join(BASELINE_DIR, `${snapshot.id}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8"
  );
}

export async function readBaseline(id: string): Promise<BaselineSnapshot | null> {
  try {
    const raw = await readFile(path.join(BASELINE_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as BaselineSnapshot;
  } catch {
    return null;
  }
}

export async function listBaselines(): Promise<BaselineSnapshot[]> {
  try {
    const names = await readdir(BASELINE_DIR);
    const rows: BaselineSnapshot[] = [];
    for (const name of names.filter((item) => item.endsWith(".json"))) {
      const row = await readBaseline(name.replace(/\.json$/, ""));
      if (row) rows.push(row);
    }
    return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  } catch {
    return [];
  }
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

export async function captureAndStoreBaseline(origin: string): Promise<FactoryWorkspace> {
  const { captureBaseline } = await import("./crawl");
  const snapshot = await captureBaseline({
    origin,
    source: origin.includes("sitesinc.co") ? "live_production" : "local",
  });
  await saveBaseline(snapshot);
  return updateWorkspace((workspace) => {
    workspace.latestBaselineId = snapshot.id;
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
  const dir = path.join(ROOT, "screenshots");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), input.bytes);
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

export const UPLOAD_DIR = path.join(ROOT, "screenshots");

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

export async function patchBacklink(id: string, status?: string) {
  return updateWorkspace((workspace) => {
    workspace.backlinks = workspace.backlinks.map((link) =>
      link.id === id ? { ...link, status: (status as typeof link.status) || link.status } : link
    );
    return workspace;
  });
}

export async function runChecks(origin: string) {
  const { applyFactoryAction } = await import("./actions");
  return applyFactoryAction("run-conversions", { origin });
}

