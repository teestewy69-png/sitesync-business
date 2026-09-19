import { appendProject, findProjectByLeadId, newId } from "@/lib/store";
import { runConversionChecks, conversionEvent } from "./conversions";
import { draftFromBrief, wordCount } from "./drafts";
import { DISCLAIMERS, SEED_BRIEFS, STAGE_DEFS } from "./pipeline";
import { slugsForSurfaces } from "./surfaces";
import { inspectUrl, sitemapSubmission } from "./search-console";
import type {
  BacklinkRecord,
  FactoryStage,
  FactoryWorkspace,
  IntakeProject,
  StageKey,
  StageStatus,
} from "./types";
import { FACTORY_PROJECT_ID } from "./types";
import { latestBaseline, updateWorkspace } from "./workspace";

function markStage(
  stages: FactoryStage[],
  key: StageKey,
  status: StageStatus,
  extras: Partial<FactoryStage> = {}
): FactoryStage[] {
  return stages.map((stage) =>
    stage.key === key
      ? {
          ...stage,
          status,
          operatorApproval: extras.operatorApproval ?? stage.operatorApproval,
          approvedBy: extras.approvedBy ?? stage.approvedBy,
          approvedAt: extras.approvedAt ?? stage.approvedAt,
          completedAt: extras.completedAt ?? stage.completedAt,
          notes: extras.notes ?? stage.notes,
          artifacts: extras.artifacts ?? stage.artifacts,
        }
      : stage
  );
}

function nowIso() {
  return new Date().toISOString();
}

export async function recordIntakeProject(input: {
  source: IntakeProject["source"];
  label: string;
  leadId?: string;
  monitoringInterest?: boolean;
}): Promise<IntakeProject> {
  if (input.leadId) {
    const existing = await findProjectByLeadId(input.leadId);
    if (existing) {
      return {
        id: existing.id,
        source: existing.source,
        createdAt: existing.createdAt,
        label: existing.label,
        factoryProjectId: FACTORY_PROJECT_ID,
        leadId: existing.leadId,
        monitoringInterest: existing.monitoringInterest ?? input.monitoringInterest,
      };
    }
  }

  const stored = await appendProject({
    id: newId("proj"),
    source: input.source,
    createdAt: nowIso(),
    label: input.label.slice(0, 160),
    leadId: input.leadId,
    monitoringInterest: input.monitoringInterest,
  });

  const project: IntakeProject = {
    ...stored,
    factoryProjectId: FACTORY_PROJECT_ID,
  };

  try {
    await updateWorkspace((workspace) => {
      workspace.intakeProjects = [project, ...workspace.intakeProjects].slice(0, 200);
      workspace.conversions.events = [
        conversionEvent("internal_project", "/app", project.id),
        conversionEvent("intake_success", input.source, project.label),
        ...workspace.conversions.events,
      ].slice(0, 400);
      return workspace;
    });
  } catch (err) {
    console.warn("Factory workspace write skipped; CRM store is source of truth:", err);
  }

  return project;
}

export async function applyFactoryAction(
  op: string,
  body: Record<string, string | string[] | undefined>
): Promise<{ ok: boolean; error?: string; workspace?: FactoryWorkspace }> {
  const actor = String(body.approvedBy || "operator");
  const when = nowIso();

  if (op === "approve-stage") {
    const key = String(body.key || "") as StageKey;
    if (!STAGE_DEFS.some((def) => def.key === key)) return { ok: false, error: "Unknown stage." };
    const workspace = await updateWorkspace((current) => {
      current.stages = markStage(current.stages, key, "approved", {
        operatorApproval: true,
        approvedBy: actor,
        approvedAt: when,
        completedAt: when,
        notes: String(body.notes || current.stages.find((s) => s.key === key)?.notes || ""),
        artifacts: current.stages.find((s) => s.key === key)?.artifacts || [],
      });
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "complete-stage") {
    const key = String(body.key || "") as StageKey;
    const workspace = await updateWorkspace((current) => {
      current.stages = markStage(current.stages, key, "complete", {
        completedAt: when,
        notes: String(body.notes || ""),
      });
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "approve-brief") {
    const id = String(body.id || "");
    const workspace = await updateWorkspace((current) => {
      current.briefs = current.briefs.map((brief) =>
        brief.id === id
          ? { ...brief, status: "approved", approvedBy: actor, approvedAt: when }
          : brief
      );
      const brief = current.briefs.find((item) => item.id === id);
      if (brief) {
        current.pages = current.pages.map((page) =>
          page.slug === brief.slug && page.status === "brief_required"
            ? { ...page, status: "drafting", briefId: brief.id }
            : page
        );
      }
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "draft-page") {
    const slug = String(body.slug || "");
    const draft = draftFromBrief(slug);
    if (!draft) return { ok: false, error: "No draft template for that slug." };
    const current = await (await import("./workspace")).readWorkspace();
    const brief = current.briefs.find((item) => item.slug === slug);
    if (brief && brief.status !== "approved") {
      return { ok: false, error: "Approve the content brief before drafting." };
    }
    const workspace = await updateWorkspace((next) => {
      const row = next;
      row.pages = row.pages.map((page) =>
        page.slug === slug
          ? {
              ...page,
              ...draft,
              wordCount: wordCount(draft.body),
              status: "ready_for_review",
              noindex: true,
            }
          : page
      );
      return row;
    });
    return { ok: true, workspace };
  }

  if (op === "approve-page") {
    const slug = String(body.slug || "");
    const workspace = await updateWorkspace((current) => {
      current.pages = current.pages.map((page) =>
        page.slug === slug && page.body.trim()
          ? {
              ...page,
              status: "approved",
              approvedBy: actor,
              approvedAt: when,
              noindex: true,
            }
          : page
      );
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "stage-pages") {
    const workspace = await updateWorkspace((current) => {
      const slugs = current.pages.filter((page) => page.status === "approved").map((page) => page.slug);
      current.pages = current.pages.map((page) =>
        page.status === "approved" ? { ...page, status: "staged", noindex: true } : page
      );
      current.deployments.unshift({
        id: newId("dep"),
        environment: "staging",
        createdAt: when,
        approvedBy: actor,
        notes: "Staging remains noindex. Production homepage untouched.",
        snapshot: { pageSlugs: slugs, productionLive: true },
      });
      current.stages = markStage(current.stages, "staging_build", "complete", {
        operatorApproval: true,
        approvedBy: actor,
        approvedAt: when,
        completedAt: when,
        artifacts: slugs.map((slug) => `/app/staging/${slug}`),
        notes: DISCLAIMERS.production,
      });
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "select-production-surfaces") {
    const raw = body.surfaces;
    const selected = (Array.isArray(raw) ? raw : String(raw || "").split(","))
      .map((item) => String(item).trim())
      .filter(Boolean);
    if (selected.includes("homepage")) {
      return {
        ok: false,
        error: "Homepage replacement is blocked. Record other surfaces first. Live sitesinc.co stays as-is.",
      };
    }
    const workspace = await updateWorkspace((current) => {
      current.productionRelease = {
        selected,
        approvedBy: actor,
        approvedAt: when,
        notes: String(body.notes || "Surfaces selected. Pages are not live on sitesinc.co until a Netlify production deploy."),
        homepageReplaced: false,
      };
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "publish-pages") {
    const workspace = await updateWorkspace((current) => {
      const blocking = current.conversions.launchBlocking;
      if (blocking) throw new Error("Conversion checks are launch-blocking. Fix them before production.");
      const allowed = slugsForSurfaces(current.productionRelease?.selected || []);
      if (!allowed.length) {
        throw new Error("Select production surfaces first. This is a separate approval from staging.");
      }
      const staged = current.pages.filter(
        (page) => page.status === "staged" && page.approvedBy && allowed.includes(page.slug)
      );
      if (!staged.length) throw new Error("No approved staged pages match the selected production surfaces.");
      const slugs = staged.map((page) => page.slug);
      current.rollbackOf = current.deployments[0]?.id || "";
      current.pages = current.pages.map((page) =>
        slugs.includes(page.slug)
          ? { ...page, status: "published", noindex: false, publishedAt: when }
          : page
      );
      current.deployments.unshift({
        id: newId("dep"),
        environment: "production",
        createdAt: when,
        approvedBy: actor,
        notes: `${DISCLAIMERS.production} ${DISCLAIMERS.rankings}`,
        snapshot: { pageSlugs: slugs, productionLive: true },
      });
      current.stages = markStage(current.stages, "production_deployment", "complete", {
        operatorApproval: true,
        approvedBy: actor,
        approvedAt: when,
        completedAt: when,
        artifacts: slugs.map((slug) => `/${slug}`),
        notes: "Homepage not replaced. New factory pages only.",
      });
      current.productionLive = true;
      current.visibleGaps = current.visibleGaps.map((gap) =>
        gap.id === "netlify-deploy"
          ? {
              ...gap,
              detail:
                "Pages are published in this repo. Live sitesinc.co updates after you deploy this build. Homepage still the existing production page.",
            }
          : gap
      );
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "rollback") {
    const workspace = await updateWorkspace((current) => {
      const published = current.pages.filter((page) => page.status === "published").map((page) => page.slug);
      current.pages = current.pages.map((page) =>
        page.status === "published"
          ? { ...page, status: "rolled_back", noindex: true, publishedAt: "" }
          : page
      );
      current.deployments.unshift({
        id: newId("dep"),
        environment: "rollback",
        createdAt: when,
        approvedBy: actor,
        notes: "Factory pages pulled back to noindex. Existing marketing homepage remains live.",
        snapshot: { pageSlugs: published, productionLive: true },
      });
      current.productionLive = true;
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "submit-indexing") {
    const workspace = await updateWorkspace((current) => {
      current.indexing = current.indexing.map((row) => {
        const published =
          row.path === "/" ||
          current.pages.some((page) => page.path === row.path && page.status === "published");
        if (!published && row.path !== "/") return row;
        if (row.state === "indexed" && row.source === "search_console") return row;
        return {
          ...row,
          state: row.state === "not_submitted" ? "submitted" : row.state,
          lastChecked: when,
          source: row.source === "search_console" ? row.source : "sitemap",
          notes: DISCLAIMERS.indexing,
        };
      });
      current.stages = markStage(current.stages, "indexing_submission", "complete", {
        operatorApproval: true,
        approvedBy: actor,
        approvedAt: when,
        completedAt: when,
        notes: DISCLAIMERS.indexing,
        artifacts: ["/sitemap.xml"],
      });
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "verify-indexing") {
    const { readWorkspace } = await import("./workspace");
    const current = await readWorkspace();
    const indexing = await Promise.all(
      current.indexing.map(async (row) => {
        const published =
          row.path === "/" ||
          current.pages.some((page) => page.path === row.path && page.status === "published");
        if (!published && row.path !== "/") return row;
        const inspected = await inspectUrl(row.url);
        if (inspected.source === "not_configured") {
          return sitemapSubmission(row, true);
        }
        return {
          ...row,
          state: inspected.state,
          lastChecked: inspected.lastChecked,
          source: inspected.source,
          notes: inspected.notes,
        };
      })
    );
    const workspace = await updateWorkspace((next) => {
      next.indexing = indexing;
      return next;
    });
    return { ok: true, workspace };
  }

  if (op === "add-backlink") {
    const record: BacklinkRecord = {
      id: newId("bl"),
      referringDomain: String(body.referringDomain || "").trim(),
      destinationUrl: String(body.destinationUrl || "").trim(),
      anchor: String(body.anchor || "").trim(),
      relevance: String(body.relevance || "").trim(),
      qualityNotes: String(body.qualityNotes || "").trim(),
      acquisitionMethod: String(body.acquisitionMethod || "").trim(),
      discoveredDate: when.slice(0, 10),
      status: "active",
    };
    if (!record.referringDomain || !record.destinationUrl) {
      return { ok: false, error: "Referring domain and destination URL are required. Do not fabricate links." };
    }
    const workspace = await updateWorkspace((current) => {
      current.backlinks.unshift(record);
      current.stages = markStage(current.stages, "backlink_authority", "in_progress", {
        notes: `${DISCLAIMERS.backlinks} ${current.backlinks.length} live referring domain(s) documented. Empty would mean none earned.`,
        artifacts: current.backlinks.map((item) => item.referringDomain),
      });
      return current;
    });
    return { ok: true, workspace };
  }

  if (op === "run-conversions") {
    const origin = String(body.origin || "http://127.0.0.1:3000");
    const { readWorkspace } = await import("./workspace");
    const current = await readWorkspace();
    const conversions = await runConversionChecks(current, origin);
    const next = await updateWorkspace((workspace) => {
      workspace.conversions = conversions;
      workspace.stages = markStage(workspace.stages, "monitoring_reporting", "in_progress", {
        notes: "Living 90-day study. Conversion checks recorded. No revenue claims.",
        artifacts: [`checks:${conversions.checks.length}`],
      });
      return workspace;
    });
    return { ok: true, workspace: next };
  }

  if (op === "kickoff-to-staging") {
    const baseline = await latestBaseline();
    if (!baseline) return { ok: false, error: "Capture a dated baseline first." };
    const research = await applyFactoryAction("advance-research", { approvedBy: actor });
    if (!research.ok) return research;
    for (const brief of SEED_BRIEFS) {
      const approved = await applyFactoryAction("approve-brief", { id: brief.id, approvedBy: actor });
      if (!approved.ok) return approved;
      const drafted = await applyFactoryAction("draft-page", { slug: brief.slug, approvedBy: actor });
      if (!drafted.ok) return drafted;
      const pageOk = await applyFactoryAction("approve-page", { slug: brief.slug, approvedBy: actor });
      if (!pageOk.ok) return pageOk;
    }
    const seo = await applyFactoryAction("approve-stage", {
      key: "content_briefs",
      approvedBy: actor,
      notes: "All priority briefs approved.",
    });
    if (!seo.ok) return seo;
    await applyFactoryAction("approve-stage", {
      key: "content_drafting",
      approvedBy: actor,
      notes: "Drafts generated from approved briefs.",
    });
    await applyFactoryAction("approve-stage", {
      key: "human_approval",
      approvedBy: actor,
      notes: "Operator approved priority page drafts.",
    });
    await applyFactoryAction("approve-stage", {
      key: "technical_seo",
      approvedBy: actor,
      notes: "Preflight generated from baseline + staging noindex rule.",
    });
    await updateWorkspace((current) => {
      current.stages = markStage(current.stages, "backlink_authority", "in_progress", {
        notes: `${DISCLAIMERS.backlinks} Tracker is empty on Day 0 — that is documented activity, not a missing field. Record a row only after a live relevant link exists.`,
        artifacts: ["backlink-tracker:empty"],
      });
      current.visibleGaps = current.visibleGaps.map((gap) =>
        gap.id === "backlink-outreach"
          ? {
              ...gap,
              status: "open",
              detail:
                "Day 0: no earned referring domains. Outreach is operator-owned and will be dated when a live link appears. Do not invent domains to fill this row.",
            }
          : gap
      );
      return current;
    });
    return applyFactoryAction("stage-pages", { approvedBy: actor });
  }

  if (op === "kickoff-to-publish") {
    const staged = await applyFactoryAction("kickoff-to-staging", { approvedBy: actor });
    if (!staged.ok) return staged;
    const origin = String(body.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000");
    const conversions = await applyFactoryAction("run-conversions", { approvedBy: actor, origin });
    if (!conversions.ok) return conversions;
    if (conversions.workspace?.conversions.launchBlocking) {
      return {
        ok: false,
        error: "Conversion checks are launch-blocking. Fix them before production.",
        workspace: conversions.workspace,
      };
    }
    const published = await applyFactoryAction("publish-pages", { approvedBy: actor });
    if (!published.ok) return published;
    const submitted = await applyFactoryAction("submit-indexing", { approvedBy: actor });
    if (!submitted.ok) return submitted;
    return applyFactoryAction("verify-indexing", { approvedBy: actor });
  }

  if (op === "record-intake") {
    await recordIntakeProject({
      source: (String(body.source || "factory_intake") as IntakeProject["source"]),
      label: String(body.label || "Factory intake (no PII stored)"),
    });
    const { readWorkspace } = await import("./workspace");
    return { ok: true, workspace: await readWorkspace() };
  }

  if (op === "advance-research") {
    const baseline = await latestBaseline();
    if (!baseline) return { ok: false, error: "Capture a dated baseline first." };
    const workspace = await updateWorkspace((current) => {
      current.stages = markStage(current.stages, "research", "complete", {
        operatorApproval: true,
        approvedBy: actor,
        approvedAt: when,
        completedAt: when,
        artifacts: [baseline.id, `${baseline.pageInventory.length} pages`],
        notes: `Baseline ${baseline.id} from ${baseline.origin} at ${baseline.capturedAt}.`,
      });
      current.stages = markStage(current.stages, "blueprint", "complete", {
        operatorApproval: true,
        approvedBy: actor,
        approvedAt: when,
        completedAt: when,
        artifacts: current.clusters.map((cluster) => cluster.hubPath),
        notes: "Topic clusters approved. No city doorway pages in the blueprint.",
      });
      current.study.checkpoints = current.study.checkpoints.map((item) =>
        item.day === 0
          ? {
              ...item,
              status: "complete",
              capturedAt: baseline.capturedAt,
              evidence: [baseline.id],
              notes: `Live baseline stored. Study horizon 90 days from ${current.study.startedAt.slice(0, 10)}.`,
            }
          : item
      );
      return current;
    });
    return { ok: true, workspace };
  }

  return { ok: false, error: `Unknown action: ${op}` };
}
