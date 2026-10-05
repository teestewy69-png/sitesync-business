import {
  StoreError,
  isStoreConflict,
  readDoc,
  writeDoc,
} from "@/lib/persistence";
import type { ClientBuildConfig } from "./client-config";
import {
  createClientFactoryProject,
  seedClientBlueprint,
  seedClientBriefs,
  seedClientClusters,
  seedClientPages,
  seedClientResearchNotes,
  seedClientStages,
} from "./client-pipeline";
import type { FactoryWorkspace, VisibleGap } from "./types";

const SAFE_PROJECT_ID = /^[a-z0-9_-]{1,80}$/i;
const MAX_UPDATE_ATTEMPTS = 30;

/** Per-client workspace docs: factory/clients/<projectId>/workspace */
export function clientWorkspaceKey(projectId: string): string {
  if (!SAFE_PROJECT_ID.test(projectId)) {
    throw new StoreError("write", "Invalid client project id for workspace key.");
  }
  return `factory/clients/${projectId}/workspace`;
}

let updateChain: Promise<unknown> = Promise.resolve();

function seedClientGaps(config: ClientBuildConfig): VisibleGap[] {
  return [
    {
      id: "competitor-urls",
      area: "Research / briefs",
      owner: "operator",
      status: "open",
      detail:
        "Analyze top 3: attach real public competitor URLs on each content brief (competitorUrls). Empty means not done — never invent domains.",
    },
    {
      id: "client-copy",
      area: "Content",
      owner: "operator",
      status: "open",
      detail:
        "Drafts are not auto-written by an LLM in this path. Approve briefs, then draft/approve pages with real client facts.",
    },
    {
      id: "client-publish",
      area: "Production",
      owner: "operator",
      status: "open",
      detail:
        "Client deliverable preview is /demo/client/<projectId>. Netlify production publish for the client is manual — not auto-wired.",
    },
    {
      id: "client-photos",
      area: "Assets",
      owner: "operator",
      status: "open",
      detail: `Collect real photos / logo for ${config.businessName}. Preview may use placeholder trust copy until then.`,
    },
  ];
}

export function seedClientWorkspace(
  projectId: string,
  config: ClientBuildConfig
): FactoryWorkspace {
  const startedAt = new Date().toISOString();
  const blueprint = seedClientBlueprint(config);
  const briefs = seedClientBriefs(config);
  const stages = seedClientStages();
  stages[0] = {
    ...stages[0],
    status: "in_progress",
    notes: seedClientResearchNotes(config),
    artifacts: [`template:${config.templateId}`, `design:${config.designStyleId}`],
  };
  stages[1] = {
    ...stages[1],
    status: "ready_for_review",
    notes: `Blueprint seeded from template ${config.templateId} for ${config.businessName}.`,
    artifacts: blueprint.map((page) => page.path),
  };
  stages[2] = {
    ...stages[2],
    status: "in_progress",
    notes:
      "Briefs seeded with client niche/location. Fill competitorUrls (analyze top 3) before approval.",
    artifacts: briefs.map((brief) => brief.id),
  };

  return {
    project: { ...createClientFactoryProject(projectId, config), createdAt: startedAt },
    stages,
    clusters: seedClientClusters(config),
    blueprint,
    briefs,
    pages: seedClientPages(briefs, blueprint),
    indexing: blueprint.map((page) => ({
      path: page.path,
      url: "",
      state: "not_submitted" as const,
      lastChecked: "",
      source: "none",
      notes: "Client site is not on a production domain yet. Indexing waits for a real launch.",
    })),
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
      checkpoints: [
        {
          day: 0,
          label: "Day 0 — client intake seeded",
          dueDate: startedAt,
          status: "complete",
          capturedAt: startedAt,
          notes: "Structured config + template + design bound. Not a Sitesinc baseline crawl.",
          evidence: [`project:${projectId}`],
        },
        {
          day: 30,
          label: "Day 30 — optional recapture",
          dueDate: new Date(Date.parse(startedAt) + 30 * 86400000).toISOString(),
          status: "scheduled",
          capturedAt: "",
          notes: "Only after the client site is live somewhere real.",
          evidence: [],
        },
        {
          day: 60,
          label: "Day 60",
          dueDate: new Date(Date.parse(startedAt) + 60 * 86400000).toISOString(),
          status: "scheduled",
          capturedAt: "",
          notes: "",
          evidence: [],
        },
        {
          day: 90,
          label: "Day 90",
          dueDate: new Date(Date.parse(startedAt) + 90 * 86400000).toISOString(),
          status: "scheduled",
          capturedAt: "",
          notes: "",
          evidence: [],
        },
      ],
    },
    visibleGaps: seedClientGaps(config),
    latestBaselineId: "",
    latestBaselineBySite: {},
    productionLive: false,
    rollbackOf: "",
    productionRelease: {
      selected: [],
      approvedBy: "",
      approvedAt: "",
      notes: "Client production deploy is manual.",
      homepageReplaced: false,
    },
    clientContext: {
      clientProjectId: projectId,
      businessName: config.businessName,
      niche: config.niche,
      city: config.city,
      state: config.state,
      designStyleId: config.designStyleId,
      templateId: config.templateId,
      email: config.email,
      phone: config.phone,
      primaryGoal: config.primaryGoal,
    },
  };
}

export async function readClientWorkspace(projectId: string): Promise<FactoryWorkspace | null> {
  if (!SAFE_PROJECT_ID.test(projectId)) return null;
  const doc = await readDoc<FactoryWorkspace>(clientWorkspaceKey(projectId));
  if (!doc) return null;
  if (doc.value?.clientContext?.clientProjectId && doc.value.clientContext.clientProjectId !== projectId) {
    throw new StoreError(
      "corrupt",
      "Stored client workspace project id mismatch; refusing to overwrite."
    );
  }
  return doc.value;
}

export async function readClientWorkspaceState(
  projectId: string
): Promise<{ workspace: FactoryWorkspace; persisted: boolean } | null> {
  const workspace = await readClientWorkspace(projectId);
  if (!workspace) return null;
  return { workspace, persisted: true };
}

/**
 * Create-only: seed a per-client factory workspace from config.
 * Never overwrites an existing client workspace.
 */
export async function initClientWorkspace(
  projectId: string,
  config: ClientBuildConfig
): Promise<{ created: boolean; workspace: FactoryWorkspace }> {
  const key = clientWorkspaceKey(projectId);
  const existing = await readDoc<FactoryWorkspace>(key);
  if (existing) return { created: false, workspace: existing.value };
  const workspace = seedClientWorkspace(projectId, config);
  try {
    await writeDoc(key, workspace, { expectedVersion: null });
    return { created: true, workspace };
  } catch (err) {
    if (isStoreConflict(err)) {
      const again = await readDoc<FactoryWorkspace>(key);
      if (again) return { created: false, workspace: again.value };
    }
    throw err;
  }
}

export async function updateClientWorkspace(
  projectId: string,
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void
): Promise<FactoryWorkspace> {
  const run = updateChain.then(() => applyClientUpdate(projectId, mutate));
  updateChain = run.catch(() => undefined);
  return run as Promise<FactoryWorkspace>;
}

async function applyClientUpdate(
  projectId: string,
  mutate: (workspace: FactoryWorkspace) => FactoryWorkspace | void
): Promise<FactoryWorkspace> {
  const key = clientWorkspaceKey(projectId);
  for (let attempt = 1; ; attempt += 1) {
    const doc = await readDoc<FactoryWorkspace>(key);
    if (!doc) {
      throw new StoreError(
        "write",
        "Client workspace does not exist yet. Call initClientWorkspace first."
      );
    }
    const next = mutate(doc.value) || doc.value;
    try {
      await writeDoc(key, next, { expectedVersion: doc.version });
      return next;
    } catch (err) {
      if (isStoreConflict(err) && attempt < MAX_UPDATE_ATTEMPTS) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(20 * attempt, 150) + Math.floor(Math.random() * 40))
        );
        continue;
      }
      throw err;
    }
  }
}

/** Attach competitor URLs to a client brief (analyze top 3 workflow). */
export async function setClientBriefCompetitors(
  projectId: string,
  briefId: string,
  competitorUrls: string[]
): Promise<FactoryWorkspace> {
  const cleaned = competitorUrls
    .map((url) => String(url || "").trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 3);
  return updateClientWorkspace(projectId, (workspace) => {
    workspace.briefs = workspace.briefs.map((brief) =>
      brief.id === briefId
        ? {
            ...brief,
            competitorUrls: cleaned,
            notes:
              cleaned.length > 0
                ? `competitorUrls set (${cleaned.length}). Analyze gaps before approving.`
                : brief.notes,
          }
        : brief
    );
    workspace.visibleGaps = workspace.visibleGaps.map((gap) =>
      gap.id === "competitor-urls" && cleaned.length > 0
        ? {
            ...gap,
            status: cleaned.length >= 3 ? "done" : "open",
            detail: `${cleaned.length}/3 competitor URL(s) attached on brief ${briefId}.`,
          }
        : gap
    );
    return workspace;
  });
}
