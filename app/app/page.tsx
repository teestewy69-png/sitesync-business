import { headers } from "next/headers";
import Link from "next/link";
import ClientConfigForm from "@/components/factory/ClientConfigForm";
import ActionForm from "@/components/factory/ActionForm";
import CityLaunchBay from "@/components/factory/CityLaunchBay";
import DomainIQBay from "@/components/factory/DomainIQBay";
import SiteGrowBay from "@/components/factory/SiteGrowBay";
import SiteFlowBay from "@/components/factory/SiteFlowBay";
import CaptureButton from "@/components/factory/CaptureButton";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { PRODUCTION_ORIGIN } from "@/lib/factory/pipeline";
import { latestBaseline, readWorkspace } from "@/lib/factory/workspace";
import { summarizeCityLaunchBay } from "@/lib/factory/city-launch";
import { summarizeDomainBay } from "@/lib/factory/domainiq";
import { SITEFLOW_PAUSED_LABEL, siteflowEnabled } from "@/lib/siteflow/flag";
import { summarizeSiteFlow, type SiteFlowSummary } from "@/lib/siteflow/summary";
import { ensureBlobsFromRequest, listProjects } from "@/lib/store";

export default async function FactoryHome() {
  const workspace = await readWorkspace();
  const baseline = await latestBaseline();
  ensureBlobsFromRequest({ headers: await headers() });
  let clientProjects: Awaited<ReturnType<typeof listProjects>> = [];
  try {
    clientProjects = await listProjects();
  } catch (err) {
    console.warn("DomainIQ bay: client projects unavailable.", err instanceof Error ? err.name : "unknown");
  }
  const domainBay = summarizeDomainBay(clientProjects);
  const cityBay = await summarizeCityLaunchBay(clientProjects);
  const siteflowOn = siteflowEnabled();
  let siteflow: SiteFlowSummary | null = null;
  if (siteflowOn) {
    try {
      siteflow = await summarizeSiteFlow();
    } catch (err) {
      console.warn("SiteFlow bay: summary unavailable.", err instanceof Error ? err.name : "unknown");
    }
  }

  return (
    <FactoryShell title="Warehouse">
      <p className="max-w-3xl text-lg text-zinc-300">
        Start with a client, then walk the line. Purple builds the site. Blue is DomainIQ. Green is ScaleQuan city
        pages. Red monitors and releases.
      </p>

      <ClientConfigForm />

      <SiteGrowBay projects={clientProjects} />

      <DomainIQBay summary={domainBay} siteflowEnabled={siteflowOn} />

      <CityLaunchBay summary={cityBay} />

      <section className="mt-16 rounded-2xl border border-rose-400/40 bg-rose-500/5 p-6" id="ship-bay">
        <h2 className="text-2xl font-semibold text-rose-200">4. Ship</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Red is the end of the line. Capture a baseline, check staging, read SEO, then release. A client domain
          still needs a manual production deploy.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {[
            ["/app/baseline", "Baseline", baseline ? `${baseline.pageInventory.length} pages in the Sitesinc study crawl` : "Sitesinc study crawl not captured yet"],
            ["/app/staging", "Staging", "Preview stays noindex"],
            ["/app/seo", "SEO", "Monitor from the dated baseline"],
            ["/app/release", "Release", "QA gate before anything goes live"],
          ].map(([href, label, detail]) => (
            <li key={href}>
              <Link href={href} className="block rounded-xl border border-rose-400/20 px-4 py-3 hover:bg-rose-500/10">
                <span className="font-semibold text-rose-100">{label}</span>
                <span className="mt-1 block text-sm text-zinc-400">{detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {!siteflowOn ? (
        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5" id="siteflow-bay">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">SiteFlow</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                Paused for phase 2 (Path A). The public offer is only the website build ($1,995, 50% to start, 50%
                at launch) and optional $129/mo monitoring, invoiced by hand. Product checkout, the Stripe webhook, digital
                delivery and download links, partner referrals (?ref=), /go affiliate links and /tools are switched off and
                answer 404. The code is kept; turning it back on is Tony&apos;s call (SITEFLOW_ENABLED=true, then redeploy).
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
              {SITEFLOW_PAUSED_LABEL}
            </span>
          </div>
        </section>
      ) : siteflow ? (
        <SiteFlowBay summary={siteflow} origin={process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_ORIGIN} />
      ) : (
        <p className="mt-10 rounded-xl border border-amber-400/30 px-4 py-3 text-sm text-amber-200">SiteFlow bay unavailable (store error).</p>
      )}

      <h2 className="mt-20 text-xl font-semibold text-zinc-200">Sitesinc case study</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        {workspace.project.name} ┬╖ {workspace.study.horizonDays}-day study started {workspace.study.startedAt.slice(0, 10)}.
        Production stays at {workspace.project.productionUrl}.
        {baseline ? ` Latest baseline ${baseline.capturedAt.slice(0, 10)}, ${baseline.pageInventory.length} pages.` : " Baseline not captured yet."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <CaptureButton origin={PRODUCTION_ORIGIN} />
        <ActionForm op="advance-research" label="Complete research + blueprint" fields={{ approvedBy: "operator" }} />
        <ActionForm op="kickoff-to-staging" label="Run briefs ΓåÆ drafts ΓåÆ staging" fields={{ approvedBy: "operator" }} />
        <ActionForm
          op="kickoff-to-publish"
          label="Stage ΓåÆ convert-check ΓåÆ publish ΓåÆ submit"
          fields={{
            approvedBy: "operator",
            origin: process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000",
          }}
        />
        <ActionForm
          op="record-intake"
          label="Convert intake ΓåÆ internal project"
          tone="muted"
          fields={{ source: "factory_intake", label: "Operator factory intake (no PII)" }}
        />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Pipeline</h2>
      <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
        {workspace.stages.map((stage) => (
          <div key={stage.key} className="grid gap-3 px-4 py-4 md:grid-cols-[2rem_1fr_auto]">
            <span className="text-sm text-slate-500">{stage.order}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{stage.name}</p>
                <Pill tone={stage.status === "complete" || stage.status === "approved" ? "ok" : "muted"}>
                  {stage.status}
                </Pill>
              </div>
              <p className="mt-1 text-sm text-slate-400">Needs: {stage.requiredInputs.join(" ┬╖ ")}</p>
              {stage.artifacts.length ? (
                <p className="mt-1 text-sm text-slate-500">Artifacts: {stage.artifacts.join(", ")}</p>
              ) : null}
              {stage.notes ? <p className="mt-1 text-sm text-slate-400">{stage.notes}</p> : null}
              <p className="mt-1 text-xs text-slate-600">
                Approval: {stage.operatorApproval ? `${stage.approvedBy} @ ${stage.approvedAt.slice(0, 16)}` : "required"}
                {stage.completedAt ? ` ┬╖ Done ${stage.completedAt.slice(0, 16)}` : ""}
              </p>
            </div>
            <ActionForm
              op="approve-stage"
              label="Approve"
              tone="muted"
              fields={{ key: stage.key, approvedBy: "operator" }}
            />
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Visible gaps (not hidden)</h2>
      <ul className="mt-3 space-y-2">
        {workspace.visibleGaps.map((gap) => (
          <li key={gap.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
            <Pill>{gap.area}</Pill>{" "}
            <span className="font-medium text-white">{gap.owner}</span> ΓÇö {gap.detail}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">90-day checkpoints</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {workspace.study.checkpoints.map((item) => (
          <div key={item.day} className="rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{item.label}</p>
              <Pill tone={item.status === "complete" ? "ok" : "warn"}>{item.status}</Pill>
            </div>
            <p className="mt-1 text-sm text-slate-400">Due {item.dueDate.slice(0, 10)}</p>
            <p className="mt-2 text-sm text-slate-300">{item.notes}</p>
          </div>
        ))}
      </div>
    </FactoryShell>
  );
}
