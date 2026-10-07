import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CaptureButton from "@/components/factory/CaptureButton";
import CityLaunchPanel from "@/components/factory/CityLaunchPanel";
import ClientConfigForm from "@/components/factory/ClientConfigForm";
import DomainIQPanel from "@/components/factory/DomainIQPanel";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { configFromProject } from "@/lib/factory/client-config";
import { getClientTemplate } from "@/lib/factory/client-templates";
import { readClientWorkspace } from "@/lib/factory/client-workspace";
import { clientPreviewOrigin, hostOriginFrom } from "@/lib/factory/seo-sites";
import { DESIGN_STYLES } from "@/lib/design-styles";
import { findProjectById } from "@/lib/store";
import { readBaseline } from "@/lib/factory/workspace";
import { clientDomainSeedFromProject } from "@/lib/factory/domainiq";
import { cityLaunchContext, cityLaunchSummary } from "@/lib/factory/city-launch";
import { defaultWebsiteContent } from "@/lib/city-launch/prompts";

export const dynamic = "force-dynamic";

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  if (!project) notFound();

  const config = configFromProject(project);
  const template = getClientTemplate(project.templateId || config.templateId);
  const style =
    DESIGN_STYLES.find((item) => item.id === (project.designStyleId || config.designStyleId)) ||
    DESIGN_STYLES[0];
  const workspace = await readClientWorkspace(projectId);
  const pages = project.seededPages?.length ? project.seededPages : config.seededPages;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("host") || "127.0.0.1:3000";
  const hostOrigin = hostOriginFrom(process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`);
  const previewOrigin = clientPreviewOrigin(projectId, hostOrigin);

  const baselineId = workspace?.latestBaselineId || workspace?.latestBaselineBySite?.[projectId] || "";
  const baseline = baselineId ? await readBaseline(baselineId) : null;
  const ownBaseline =
    baseline && (baseline.siteId === projectId || baseline.projectId === projectId) ? baseline : null;
  const pagesOk = ownBaseline
    ? ownBaseline.pageInventory.filter((page) => page.statusCode === 200).length
    : 0;
  const pagesTotal = ownBaseline?.pageInventory.length || 0;
  const limited = ownBaseline ? pagesOk === 0 : false;
  const cityCtx = cityLaunchContext(project);
  const citySummary = await cityLaunchSummary(projectId);

  return (
    <FactoryShell title={`Client project · ${config.businessName}`}>
      <p className="max-w-3xl text-sm text-slate-400">
        Structured client config bound to template + design. Client factory workspace is separate from the
        Sitesinc growth case study (<code className="text-slate-300">sitesinc-growth-case-study</code>).
        Preview is honest: no auto-publish to Netlify. Baseline/crawl, when captured, belongs only to this
        client.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Pill tone="ok">template {template.id}</Pill>
        <Pill>design {style.id}</Pill>
        <Pill tone={workspace ? "ok" : "warn"}>
          workspace {workspace ? "initialized" : "missing"}
        </Pill>
        <Pill tone={ownBaseline ? (limited ? "warn" : "ok") : "muted"}>
          baseline {ownBaseline ? (limited ? "limited" : `${pagesOk} pages`) : "none"}
        </Pill>
        <Pill
          tone={
            workspace?.clientAutomation?.baseline?.status === "captured"
              ? "ok"
              : workspace?.clientAutomation?.baseline?.status === "pending" ||
                  workspace?.clientAutomation?.baseline?.status === "stale"
                ? "warn"
                : "muted"
          }
        >
          auto-baseline {workspace?.clientAutomation?.baseline?.status || "n/a"}
          {workspace?.clientAutomation?.baseline?.stale ? " · stale" : ""}
        </Pill>
        <Pill
          tone={
            project.domainStatus === "purchase_approved" || project.domainStatus === "selected"
              ? "ok"
              : project.domainStatus === "candidates_ready"
                ? "warn"
                : "muted"
          }
        >
          domain {project.selectedDomain || project.domainStatus || "not run"}
        </Pill>
        <Pill tone={workspace?.clientAutomation?.drafts?.seeded ? "ok" : "muted"}>
          drafts {workspace?.clientAutomation?.drafts?.seeded
            ? `seeded (${workspace.clientAutomation.drafts.pageCount})`
            : "not seeded"}
        </Pill>
        <Pill
          tone={
            workspace?.clientAutomation?.competitors?.status === "filled"
              ? "ok"
              : workspace?.clientAutomation?.competitors?.status === "needs_search_provider"
                ? "warn"
                : "muted"
          }
        >
          competitors {workspace?.clientAutomation?.competitors?.status || "n/a"}
        </Pill>
        <Link
          href={`/demo/client/${projectId}`}
          className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-400/10"
        >
          Open deliverable preview
        </Link>
        <Link
          href={`/app/seo?site=${encodeURIComponent(projectId)}`}
          className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
        >
          SEO workspace
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Baseline / crawl</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Crawls <code className="text-slate-300">{previewOrigin}</code> using this client&apos;s seeded
              paths. Result is stored under siteId <code className="text-slate-300">{projectId}</code> - never
              borrowed from Sitesinc or demo fixtures.
            </p>
            {ownBaseline ? (
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">Baseline id</dt>
                  <dd className="text-slate-200">{ownBaseline.id}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">Captured at</dt>
                  <dd className="text-slate-200">{ownBaseline.capturedAt}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">Pages found</dt>
                  <dd className="text-slate-200">
                    {pagesOk} OK / {pagesTotal} inventoried
                    {limited ? " · limited or unreachable" : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-slate-500">Origin</dt>
                  <dd className="break-all text-slate-200">{ownBaseline.origin}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-amber-100">
                No client-owned baseline yet. Capture after the preview route is reachable on this host.
              </p>
            )}
          </div>
          {workspace ? (
            <CaptureButton
              origin={previewOrigin}
              siteId={projectId}
              projectId={projectId}
              label="Capture client baseline"
            />
          ) : (
            <p className="text-xs text-slate-500">Init the client workspace before capturing.</p>
          )}
        </div>
      </section>


      <DomainIQPanel
        projectId={projectId}
        candidates={project.domainCandidates || []}
        selectedDomain={project.selectedDomain}
        domainStatus={project.domainStatus}
        state={project.domainIQ}
        seedPreview={clientDomainSeedFromProject(project)}
      />

      <CityLaunchPanel
        projectId={projectId}
        initial={citySummary}
        defaults={{
          businessName: cityCtx.business.businessName,
          niche: cityCtx.business.niche,
          baseCity: cityCtx.baseCity?.name || cityCtx.business.baseCity || "",
          baseState: cityCtx.baseCity?.state || cityCtx.business.baseState || "",
          baseInDataset: Boolean(cityCtx.baseCity),
          websiteContent: defaultWebsiteContent(cityCtx.business),
          selectedDomain: project.selectedDomain,
        }}
      />

      <section className="mt-6 rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg font-semibold">Automation status</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          What the factory auto-wires vs what stays manual. Status is persisted on the client workspace - not inferred.
        </p>
        {workspace?.clientAutomation ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 px-4 py-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">Baseline</dt>
              <dd className="mt-1 text-slate-200">
                status: <strong>{workspace.clientAutomation.baseline.status}</strong>
                {workspace.clientAutomation.baseline.stale ? " (stale)" : ""}
              </dd>
              <dd className="mt-1 text-xs text-slate-400">
                {workspace.clientAutomation.baseline.reason || "-"}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                capturedAt: {workspace.clientAutomation.baseline.capturedAt || "-"}
                {" · "}
                pages:{" "}
                {workspace.clientAutomation.baseline.pagesOk ?? "-"}/
                {workspace.clientAutomation.baseline.pagesTotal ?? "-"}
                {" · "}
                host: {workspace.clientAutomation.baseline.hostOrigin || "-"}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 px-4 py-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">Drafts seeded</dt>
              <dd className="mt-1 text-slate-200">
                {workspace.clientAutomation.drafts.seeded
                  ? `yes · ${workspace.clientAutomation.drafts.pageCount} page(s)`
                  : "no"}
              </dd>
              <dd className="mt-1 text-xs text-slate-400">
                Templated draft bodies, labeled, noindex, ready_for_review. Not LLM copy.
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                seededAt: {workspace.clientAutomation.drafts.seededAt || "-"}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 px-4 py-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">Analyze top 3 / competitors</dt>
              <dd className="mt-1 text-slate-200">
                {workspace.clientAutomation.competitors.status}
              </dd>
              <dd className="mt-1 text-xs text-slate-400">
                {workspace.clientAutomation.competitors.detail}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 px-4 py-3">
              <dt className="text-xs uppercase tracking-wider text-slate-500">Stage auto-progression</dt>
              <dd className="mt-1 text-slate-200">
                research / blueprint / content_briefs / content_drafting / technical_seo auto when data exists.
                human_approval + production_deployment stay manual.
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                last applied: {workspace.clientAutomation.stagesAutoAppliedAt || "-"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-amber-100">
            No automation block yet - init the client factory workspace first.
          </p>
        )}
      </section>

      <h2 className="mt-8 text-lg font-semibold">Client config</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Business", config.businessName],
          ["Contact", config.contactName || "-"],
          ["Email", config.email || project.email || "-"],
          ["Niche", config.niche],
          ["Type", config.businessType],
          ["Sells", config.offer || "-"],
          ["Pricing", config.pricingNote || "- (no prices shown)"],
          ["Client-owned domain", project.ownedDomain || "-"],
          ["City", config.city || "-"],
          ["State", config.state || "-"],
          ["Phone", config.phone || "-"],
          ["Primary goal", config.primaryGoal || "-"],
          ["Monitoring interest", project.monitoringInterest ? "yes" : "no"],
          ["CRM id", project.id],
          ["Factory workspace id", project.factoryWorkspaceId || project.id],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-1 text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
      {config.notes ? (
        <p className="mt-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
          Notes: {config.notes}
        </p>
      ) : null}
      <ClientConfigForm
        projectId={project.id}
        initial={{
          businessName: config.businessName,
          contactName: config.contactName,
          email: config.email,
          phone: config.phone,
          city: config.city,
          state: config.state,
          businessType: project.businessType || "",
          offer: config.offer,
          primaryGoal: config.primaryGoal,
          pricingNote: config.pricingNote,
          domain: project.ownedDomain || "",
          notes: config.notes,
        }}
      />

      <h2 className="mt-8 text-lg font-semibold">Seeded pages</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {pages.map((page) => {
          const row = workspace?.pages.find((item) => item.slug === page.slug);
          return (
            <li
              key={page.slug}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">{page.title}</p>
                <p className="text-slate-400">
                  {page.path} - {page.purpose}
                </p>
                {page.targetKeywords?.length ? (
                  <p className="text-xs text-slate-500">keywords: {page.targetKeywords.join(", ")}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Pill>{row?.status || "planned"}</Pill>
                <Link
                  href={
                    page.slug === "home"
                      ? `/demo/client/${projectId}`
                      : `/demo/client/${projectId}/${page.slug}`
                  }
                  className="text-brand-300"
                >
                  Preview
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Client factory stages</h2>
      {workspace ? (
        <ul className="mt-3 space-y-2 text-sm">
          {workspace.stages.map((stage) => (
            <li
              key={stage.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3"
            >
              <span>
                {stage.order}. {stage.name}
                {stage.notes ? (
                  <span className="mt-1 block max-w-2xl text-xs text-slate-500">{stage.notes}</span>
                ) : null}
              </span>
              <Pill
                tone={
                  stage.status === "complete" || stage.status === "approved"
                    ? "ok"
                    : stage.status === "in_progress" || stage.status === "ready_for_review"
                      ? "warn"
                      : "muted"
                }
              >
                {stage.status}
              </Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-amber-100">
          No client workspace document yet. Run factory action{" "}
          <code>init-client-factory</code> with this projectId, or re-submit intake.
        </p>
      )}

      {workspace?.briefs?.length ? (
        <>
          <h2 className="mt-8 text-lg font-semibold">Briefs (analyze top 3 = competitorUrls)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.briefs.map((brief) => (
              <li key={brief.id} className="rounded-xl border border-white/10 px-4 py-3">
                <strong>{brief.title}</strong> · {brief.status}
                <span className="mt-1 block text-slate-400">
                  competitorUrls:{" "}
                  {brief.competitorUrls.length
                    ? brief.competitorUrls.join(", ")
                    : "none - attach via set-brief-competitors"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-8 text-xs text-slate-500">
        Automated: workspace init, templated draft seed, stage auto-progress (except approval/deploy),
        baseline capture/recapture when host known, DomainIQ domain candidates + keyless availability check,
        City Launch writing jobs (LLM, retries, resume), uniqueness gate, preview publish of approved city pages.
        Manual by design: approving City Launch drafts, Tony&apos;s real-domain sign-off.
        Manual by design: domain pick + Tony&apos;s purchase sign-off (Sitesinc never buys a domain). Manual by design: human_approval, production_deployment,
        final copy polish, photos, Netlify client publish. Blocked on external setup: analyze top 3 (no
        SERP/search API key in this repo).
      </p>
    </FactoryShell>
  );
}
