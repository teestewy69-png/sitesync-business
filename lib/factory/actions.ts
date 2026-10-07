import { newId } from "@/lib/store";
import {
  applyConfigToProject,
  buildClientConfig,
  configFromProject,
  normalizeDesignStyleId,
  normalizeOwnedDomain,
  type IntakeConfigInput,
} from "./client-config";
import {
  initClientWorkspace,
  refreshClientWorkspace,
  setClientBriefCompetitors,
  updateClientWorkspace,
  readClientWorkspace,
} from "./client-workspace";
import {
  backfillClientFactories,
  markStaleAndQueueRecapture,
  queueAutoClientBaseline,
} from "./client-automation";
import { recordIntakeProject } from "./record-intake";
import {
  approveDomainPurchase,
  backfillDomainCandidates,
  checkProjectDomainAvailability,
  clearProjectDomainSelection,
  generateDomainCandidatesForProject,
  markDomainCandidatesPending,
  queueAutoDomainCandidates,
  selectProjectDomain,
} from "./domainiq";
export { recordIntakeProject } from "./record-intake";
import { runConversionChecks } from "./conversions";
import { draftFromBrief, wordCount } from "./drafts";
import { DISCLAIMERS, SEED_BRIEFS, STAGE_DEFS } from "./pipeline";
import { slugsForSurfaces } from "./surfaces";
import { inspectUrl, sitemapSubmission } from "./search-console";
import type {
  FactoryStage,
  FactoryWorkspace,
  IntakeProject,
  StageKey,
  StageStatus,
} from "./types";
import { FACTORY_PROJECT_ID } from "./types";
import { initWorkspace, latestBaseline, updateWorkspace } from "./workspace";
import {
  createBacklinkRecord,
  isAddBacklinkOp,
  isPatchBacklinkOp,
  isRemoveBacklinkOp,
  patchBacklinkList,
  removeBacklinkList,
} from "./backlink-ops";

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

export async function applyFactoryAction(
  op: string,
  body: Record<string, string | string[] | undefined>
): Promise<{ ok: boolean; error?: string; workspace?: FactoryWorkspace; created?: boolean; projectId?: string; refreshed?: string[]; kept?: string[]; backfill?: import("./client-automation").BackfillResult; domainBackfill?: import("./domainiq").DomainBackfillResult }> {
  const actor = String(body.approvedBy || "operator");
  const when = nowIso();

  if (op === "init-workspace") {
    // Marks the store as initialized (create-only; never overwrites an existing/migrated workspace).
    const { created, workspace } = await initWorkspace();
    return { ok: true, created, workspace };
  }

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

  if (isAddBacklinkOp(op)) {
    const built = createBacklinkRecord(body, newId("bl"), when);
    if (!built.ok) return built;
    const record = built.record;
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

  if (isPatchBacklinkOp(op)) {
    let patchError: string | undefined;
    const workspace = await updateWorkspace((current) => {
      const patched = patchBacklinkList(current.backlinks, body);
      if (!patched.ok) {
        patchError = patched.error;
        return current;
      }
      current.backlinks = patched.backlinks;
      current.stages = markStage(current.stages, "backlink_authority", "in_progress", {
        notes: `${DISCLAIMERS.backlinks} ${current.backlinks.length} live referring domain(s) documented. Empty would mean none earned.`,
        artifacts: current.backlinks.map((item) => item.referringDomain),
      });
      return current;
    });
    if (patchError) return { ok: false, error: patchError };
    return { ok: true, workspace };
  }

  if (isRemoveBacklinkOp(op)) {
    let removeError: string | undefined;
    const workspace = await updateWorkspace((current) => {
      const removed = removeBacklinkList(current.backlinks, body);
      if (!removed.ok) {
        removeError = removed.error;
        return current;
      }
      current.backlinks = removed.backlinks;
      current.stages = markStage(current.stages, "backlink_authority", "in_progress", {
        notes: `${DISCLAIMERS.backlinks} ${current.backlinks.length} live referring domain(s) documented. Empty would mean none earned.`,
        artifacts: current.backlinks.map((item) => item.referringDomain),
      });
      return current;
    });
    if (removeError) return { ok: false, error: removeError };
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
        notes: `${DISCLAIMERS.backlinks} Tracker is empty on Day 0 - that is documented activity, not a missing field. Record a row only after a live relevant link exists.`,
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
    const fields = clientFieldsFromBody(body);
    const hasClientDetails = Object.keys(fields).some((key) => key !== "monitoringInterest");
    const project = await recordIntakeProject({
      ...fields,
      source: (String(body.source || "factory_intake") as IntakeProject["source"]),
      label: String(body.label || fields.businessName || "Factory intake (no PII stored)"),
      hostOrigin: String(body.hostOrigin || body.origin || "").trim() || null,
    });
    if (hasClientDetails) {
      const workspace = (await readClientWorkspace(project.id)) || undefined;
      return { ok: true, created: true, projectId: project.id, workspace };
    }
    const { readWorkspace } = await import("./workspace");
    return { ok: true, projectId: project.id, workspace: await readWorkspace() };
  }

  if (op === "update-client-config") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const { findProjectById, updateProject } = await import("@/lib/store");
    const project = await findProjectById(projectId);
    if (!project) return { ok: false, error: "Client project not found." };
    const fields = clientFieldsFromBody(body);
    if (!Object.keys(fields).length) return { ok: false, error: "No client fields to update." };
    if ("domain" in fields && fields.domain && !normalizeOwnedDomain(fields.domain)) {
      return { ok: false, error: `Not a valid domain: ${fields.domain}` };
    }
    const merged = { ...project };
    const assign = <K extends keyof typeof merged>(key: K, value: (typeof merged)[K]) => {
      merged[key] = value;
    };
    if ("businessName" in fields) assign("businessName", fields.businessName || project.businessName);
    if ("contactName" in fields) assign("contactName", fields.contactName);
    if ("email" in fields) assign("email", fields.email);
    if ("phone" in fields) assign("phone", fields.phone);
    if ("city" in fields) assign("city", fields.city);
    if ("state" in fields) assign("state", fields.state);
    if ("primaryGoal" in fields) assign("primaryGoal", fields.primaryGoal);
    if ("notes" in fields) assign("notes", fields.notes);
    if ("pricingNote" in fields) assign("pricingNote", fields.pricingNote);
    if ("niche" in fields) assign("niche", fields.niche);
    if ("designStyleId" in fields) assign("designStyleId", fields.designStyleId);
    const whatChanged =
      ("businessType" in fields && fields.businessType !== project.businessType) ||
      ("offer" in fields && fields.offer !== project.offer);
    if ("businessType" in fields) assign("businessType", fields.businessType);
    if ("offer" in fields) assign("offer", fields.offer);
    if ("templateId" in fields) assign("templateId", fields.templateId);
    else if (whatChanged) {
      // Business type / offer changed and no explicit template: re-pick the template (and niche) from them.
      assign("templateId", undefined);
      if (!("niche" in fields)) assign("niche", undefined);
    }
    // Legacy bug guard: a goal equal to the business name is dropped so the template default applies.
    const config = configFromProject(merged);
    const patched = applyConfigToProject(merged, config);
    await updateProject(projectId, {
      businessName: patched.businessName,
      contactName: config.contactName || undefined,
      email: patched.email,
      niche: patched.niche,
      businessType: patched.businessType,
      offer: config.offer || undefined,
      pricingNote: config.pricingNote || undefined,
      city: patched.city,
      state: patched.state,
      phone: patched.phone,
      primaryGoal: patched.primaryGoal,
      notes: patched.notes,
      designStyleId: patched.designStyleId,
      templateId: patched.templateId,
      seededPages: patched.seededPages,
      factoryWorkspaceId: project.factoryWorkspaceId || project.id,
    });
    if ("domain" in fields) {
      const domain = normalizeOwnedDomain(fields.domain);
      if (domain && domain !== project.ownedDomain) {
        const { recordClientOwnedDomain } = await import("./domainiq");
        const owned = await recordClientOwnedDomain(projectId, domain, actor);
        if (!owned.ok) return { ok: false, error: owned.error };
      } else if (!domain && project.ownedDomain) {
        await updateProject(projectId, { ownedDomain: undefined });
      }
    }
    const hostHint = String(body.hostOrigin || body.origin || "").trim() || null;
    const refresh = await refreshClientWorkspace(projectId, config, { hostOrigin: hostHint });
    if (!refresh) {
      const init = await initClientWorkspace(projectId, config, { hostOrigin: hostHint });
      queueAutoClientBaseline(projectId, hostHint);
      return { ok: true, created: init.created, projectId, workspace: init.workspace };
    }
    const workspace = await markStaleAndQueueRecapture(
      projectId,
      "Client details changed - drafts rebuilt, baseline marked stale for auto-recapture.",
      hostHint
    );
    return {
      ok: true,
      projectId,
      refreshed: refresh.refreshed,
      kept: refresh.kept,
      workspace: workspace || refresh.workspace,
    };
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


  if (op === "init-client-factory") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const { findProjectById, updateProject } = await import("@/lib/store");
    const project = await findProjectById(projectId);
    if (!project) return { ok: false, error: "Client project not found." };
    const extra = clientFieldsFromBody(body);
    const config = buildClientConfig({
      businessName: project.businessName || extra.businessName,
      name: project.businessName || String(body.businessName || project.label),
      contactName: project.contactName || extra.contactName,
      offer: project.offer || extra.offer,
      pricingNote: project.pricingNote || extra.pricingNote,
      domain: project.ownedDomain || extra.domain,
      email: project.email || String(body.email || ""),
      niche: project.niche || String(body.niche || ""),
      businessType: project.businessType || String(body.businessType || ""),
      city: project.city || String(body.city || ""),
      state: project.state || String(body.state || ""),
      phone: project.phone || String(body.phone || ""),
      primaryGoal: project.primaryGoal || String(body.primaryGoal || ""),
      notes: project.notes || String(body.notes || ""),
      monitoringInterest: project.monitoringInterest,
      designStyleId: project.designStyleId || String(body.designStyleId || ""),
      preferredDesign: String(body.preferredDesign || ""),
      templateId: project.templateId || String(body.templateId || ""),
      label: project.label,
      source: project.source,
    });
    const patched = applyConfigToProject(project, config);
    await updateProject(project.id, {
      businessName: patched.businessName,
      contactName: config.contactName || undefined,
      offer: config.offer || undefined,
      pricingNote: config.pricingNote || undefined,
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
    const hostHint = String(body.hostOrigin || body.origin || "").trim() || null;
    if (config.domain && !project.ownedDomain) {
      const { recordClientOwnedDomain } = await import("./domainiq");
      await recordClientOwnedDomain(project.id, config.domain, actor);
    }
    const result = await initClientWorkspace(project.id, config, { hostOrigin: hostHint });
    let workspace = result.workspace;
    if (!result.created) {
      // Existing workspace: rebuild the templated drafts from the current details (keeps approved work).
      const refresh = await refreshClientWorkspace(project.id, config, { hostOrigin: hostHint });
      if (refresh) workspace = refresh.workspace;
    }
    // Auto baseline: never block the action response.
    queueAutoClientBaseline(project.id, hostHint);
    // Auto DomainIQ candidates (idempotent; skipped when candidates exist or the client owns a domain).
    if (!config.domain) {
      await markDomainCandidatesPending(project.id);
      queueAutoDomainCandidates(project.id);
    }
    return { ok: true, created: result.created, projectId: project.id, workspace };
  }

  // DomainIQ bay. Generation/scoring run in-process; availability uses keyless
  // public RDAP + DNS. Nothing here purchases, reserves, or registers a domain.
  if (op === "domainiq-generate") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const result = await generateDomainCandidatesForProject(projectId, {
      force: String(body.force ?? "1") !== "0",
      checkAvailability: String(body.checkAvailability ?? "1") !== "0",
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (op === "domainiq-check-availability") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const raw = body.domains ?? body.domain;
    const domains = (Array.isArray(raw) ? raw : String(raw || "").split(/[\n,]/))
      .map((item) => String(item).trim())
      .filter(Boolean);
    const result = await checkProjectDomainAvailability(projectId, domains.length ? domains : undefined);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (op === "domainiq-select") {
    const projectId = String(body.projectId || "");
    const domain = String(body.domain || "");
    if (!projectId || !domain) return { ok: false, error: "projectId and domain required." };
    const result = await selectProjectDomain(projectId, domain, actor);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (op === "domainiq-clear-selection") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const result = await clearProjectDomainSelection(projectId);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (op === "domainiq-approve-purchase") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const result = await approveDomainPurchase(projectId, String(body.approvedBy || ""));
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (op === "domainiq-backfill") {
    const backfill = await backfillDomainCandidates();
    return { ok: true, created: backfill.generated > 0, domainBackfill: backfill };
  }

  if (op === "set-brief-competitors") {
    const projectId = String(body.projectId || "");
    const briefId = String(body.id || body.briefId || "");
    const raw = body.competitorUrls;
    const urls = (Array.isArray(raw) ? raw : String(raw || "").split(/[\n,]/))
      .map((item) => String(item).trim())
      .filter(Boolean);
    if (!projectId || !briefId) return { ok: false, error: "projectId and brief id required." };
    if (projectId === FACTORY_PROJECT_ID) {
      const workspace = await updateWorkspace((current) => {
        current.briefs = current.briefs.map((brief) =>
          brief.id === briefId
            ? {
                ...brief,
                competitorUrls: urls.filter((url) => /^https?:\/\//i.test(url)).slice(0, 3),
                notes:
                  urls.length > 0
                    ? `competitorUrls set (${Math.min(urls.length, 3)}). Analyze gaps before approving.`
                    : brief.notes,
              }
            : brief
        );
        return current;
      });
      return { ok: true, workspace };
    }
    const workspace = await setClientBriefCompetitors(projectId, briefId, urls);
    return { ok: true, workspace };
  }

  if (op === "bind-client-design") {
    const projectId = String(body.projectId || "");
    const designStyleId = String(body.designStyleId || body.preferredDesign || "");
    if (!projectId || !designStyleId) return { ok: false, error: "projectId and designStyleId required." };
    const { findProjectById, updateProject } = await import("@/lib/store");
    const project = await findProjectById(projectId);
    if (!project) return { ok: false, error: "Client project not found." };
    const normalized = normalizeDesignStyleId(designStyleId);
    await updateProject(projectId, { designStyleId: normalized });
    try {
      const existing = await readClientWorkspace(projectId);
      if (!existing) return { ok: true };
      const hostHint = String(body.hostOrigin || body.origin || "").trim() || null;
      await updateClientWorkspace(projectId, (current) => {
        if (current.clientContext) current.clientContext.designStyleId = normalized;
        return current;
      });
      const workspace = await markStaleAndQueueRecapture(
        projectId,
        "Design binding changed - baseline marked stale for auto-recapture.",
        hostHint
      );
      return { ok: true, workspace: workspace || undefined };
    } catch {
      return { ok: true };
    }
  }


  if (op === "capture-client-baseline") {
    const projectId = String(body.projectId || "");
    if (!projectId) return { ok: false, error: "projectId required." };
    const { captureClientBaseline } = await import("./client-baseline");
    const hostOrigin = String(body.origin || body.hostOrigin || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000");
    try {
      const result = await captureClientBaseline({
        projectId,
        hostOrigin,
        origin: body.previewOrigin ? String(body.previewOrigin) : undefined,
      });
      return {
        ok: true,
        workspace: result.workspace,
        // surface truthfulness for callers that read JSON extras
        created: !result.limited,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Client baseline capture failed.",
      };
    }
  }
  if (op === "draft-client-page") {
    const projectId = String(body.projectId || "");
    const slug = String(body.slug || "");
    if (!projectId || !slug) return { ok: false, error: "projectId and slug required." };
    const { findProjectById } = await import("@/lib/store");
    const { draftFromClientBrief, wordCount: clientWordCount } = await import("./client-drafts");
    const { configFromProject } = await import("./client-config");
    const project = await findProjectById(projectId);
    if (!project) return { ok: false, error: "Client project not found." };
    const config = configFromProject(project);
    const workspace = await updateClientWorkspace(projectId, (current) => {
      const brief = current.briefs.find((item) => item.slug === slug);
      if (!brief) throw new Error("No brief for that slug.");
      if (brief.status !== "approved") throw new Error("Approve the content brief before drafting.");
      const draft = draftFromClientBrief(brief, config);
      current.pages = current.pages.map((page) =>
        page.slug === slug
          ? {
              ...page,
              ...draft,
              wordCount: clientWordCount(draft.body),
              status: "ready_for_review",
              briefId: brief.id,
              noindex: true,
            }
          : page
      );
      return current;
    });
    const hostHint = String(body.hostOrigin || body.origin || "").trim() || null;
    const refreshed = await markStaleAndQueueRecapture(
      projectId,
      `Page draft updated (${slug}) - baseline marked stale for auto-recapture.`,
      hostHint
    );
    return { ok: true, workspace: refreshed || workspace };
  }

  if (op === "backfill-client-factories") {
    const hostHint = String(body.hostOrigin || body.origin || "").trim() || null;
    const rawIds = body.projectIds;
    const projectIds = (Array.isArray(rawIds) ? rawIds : String(rawIds || "").split(/[\n,]/))
      .map((id) => String(id).trim())
      .filter(Boolean);
    const result = await backfillClientFactories({
      hostOrigin: hostHint,
      projectIds: projectIds.length ? projectIds : undefined,
    });
    return { ok: true, created: result.initialized > 0, backfill: result };
  }

  return { ok: false, error: `Unknown action: ${op}` };
}

const CLIENT_TEXT_FIELDS = [
  "businessName",
  "contactName",
  "email",
  "phone",
  "city",
  "state",
  "businessType",
  "offer",
  "niche",
  "primaryGoal",
  "domain",
  "notes",
  "pricingNote",
  "templateId",
  "designStyleId",
] as const;

/** Client detail fields present on an action body (trimmed). Absent keys stay absent; "" means clear. */
export function clientFieldsFromBody(
  body: Record<string, string | string[] | undefined>
): Partial<Pick<IntakeConfigInput, (typeof CLIENT_TEXT_FIELDS)[number]>> & { monitoringInterest?: boolean } {
  const out: Partial<Record<(typeof CLIENT_TEXT_FIELDS)[number], string>> & { monitoringInterest?: boolean } = {};
  for (const key of CLIENT_TEXT_FIELDS) {
    const raw = body[key];
    if (raw === undefined) continue;
    out[key] = String(Array.isArray(raw) ? raw[0] ?? "" : raw).trim();
  }
  if (body.monitoringInterest !== undefined) {
    out.monitoringInterest = ["1", "true", "yes", "on"].includes(String(body.monitoringInterest).toLowerCase());
  }
  return out;
}
