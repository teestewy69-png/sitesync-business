"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  BacklinkRecord,
  BaselineSnapshot,
  ContentBrief,
  FactoryPage,
  FactoryWorkspace,
  IndexingState,
  StageStatus,
} from "@/lib/factory/types";
import type { PreflightItem } from "@/lib/factory/preflight";

type Payload = {
  ok: boolean;
  error?: string;
  workspace: FactoryWorkspace;
  baseline: BaselineSnapshot | null;
  baselines: { id: string; capturedAt: string; origin: string; source: string; pages: number }[];
  preflight: PreflightItem[];
  disclaimers: Record<string, string>;
};

const TABS = [
  "overview",
  "pipeline",
  "baseline",
  "research",
  "briefs",
  "drafts",
  "seo",
  "indexing",
  "backlinks",
  "conversions",
  "case-study",
] as const;

type Tab = (typeof TABS)[number];

const card = "rounded-2xl border border-white/10 bg-white/5 p-5";

function statusClass(status: string) {
  if (status === "complete" || status === "approved" || status === "pass" || status === "ok" || status === "indexed" || status === "published") {
    return "bg-emerald-500/15 text-emerald-200";
  }
  if (status === "fail" || status === "launch_blocking" || status === "blocked" || status === "excluded_error" || status === "lost") {
    return "bg-red-500/15 text-red-200";
  }
  if (status === "in_progress" || status === "ready_for_review" || status === "warn" || status === "warning" || status === "staged") {
    return "bg-amber-500/15 text-amber-100";
  }
  return "bg-white/10 text-slate-300";
}

function Pill({ children, status }: { children: React.ReactNode; status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
      {children}
    </span>
  );
}

async function postAction(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/factory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
  return data as Payload;
}

export default function FactoryDashboard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [operator, setOperator] = useState("Tony");

  const load = useCallback(async () => {
    const res = await fetch("/api/factory", { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Could not load factory");
    setPayload(data);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  const run = async (label: string, work: () => Promise<Payload | void>) => {
    setBusy(label);
    setError("");
    try {
      const next = await work();
      if (next?.workspace) setPayload(next);
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy("");
    }
  };

  if (!payload) {
    return <p className="text-slate-400">{error || "Loading factory workspace…"}</p>;
  }

  const { workspace, baseline, preflight, disclaimers } = payload;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
            Internal · noindex
          </p>
          <h1 className="mt-1 font-semibold text-2xl text-white sm:text-3xl">
            {workspace.project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Sitesinc builds Sitesinc. Live site stays up at{" "}
            <a className="text-brand-300 hover:underline" href={workspace.project.productionUrl}>
              {workspace.project.productionUrl}
            </a>
            . Staging is {workspace.project.stagingPath}. Production is not overwritten without approval.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="text-xs text-slate-500">
            Operator
            <input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="ml-2 rounded-lg bg-black/40 px-2 py-1 text-sm text-white ring-1 ring-white/10"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/staging" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-brand-400">
              Staging
            </Link>
            <Link href="/app/case-study" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-brand-400">
              Case study
            </Link>
            <a href="/" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-brand-400">
              Public site
            </a>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === key ? "bg-brand-500 text-zinc-950" : "bg-white/5 text-slate-300"
            }`}
          >
            {key.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview workspace={workspace} baseline={baseline} busy={busy} onRun={run} operator={operator} />}
      {tab === "pipeline" && <Pipeline workspace={workspace} busy={busy} operator={operator} onRun={run} />}
      {tab === "baseline" && (
        <BaselinePanel payload={payload} busy={busy} onRun={run} />
      )}
      {tab === "research" && <ResearchPanel workspace={workspace} />}
      {tab === "briefs" && <BriefsPanel workspace={workspace} operator={operator} busy={busy} onRun={run} />}
      {tab === "drafts" && <DraftsPanel workspace={workspace} operator={operator} busy={busy} onRun={run} />}
      {tab === "seo" && (
        <SeoPanel
          workspace={workspace}
          preflight={preflight}
          disclaimers={disclaimers}
          operator={operator}
          busy={busy}
          onRun={run}
        />
      )}
      {tab === "indexing" && <IndexingPanel workspace={workspace} busy={busy} onRun={run} />}
      {tab === "backlinks" && <BacklinksPanel workspace={workspace} busy={busy} onRun={run} />}
      {tab === "conversions" && <ConversionsPanel workspace={workspace} busy={busy} onRun={run} />}
      {tab === "case-study" && <CaseStudyPanel workspace={workspace} baseline={baseline} preflight={preflight} />}
    </div>
  );
}

function Overview({
  workspace,
  baseline,
  busy,
  onRun,
  operator,
}: {
  workspace: FactoryWorkspace;
  baseline: BaselineSnapshot | null;
  busy: string;
  operator: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  const complete = workspace.stages.filter((s) => s.status === "complete" || s.status === "approved").length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className={card}>
          <p className="text-3xl font-semibold text-white">{complete}/11</p>
          <p className="text-sm text-slate-400">Stages approved</p>
        </div>
        <div className={card}>
          <p className="text-3xl font-semibold text-white">{baseline?.pageInventory.length ?? "—"}</p>
          <p className="text-sm text-slate-400">Baseline pages</p>
        </div>
        <div className={card}>
          <p className="text-3xl font-semibold text-white">{workspace.pages.filter((p) => p.status === "published").length}</p>
          <p className="text-sm text-slate-400">Factory pages live</p>
        </div>
        <div className={card}>
          <p className="text-3xl font-semibold text-amber-100">{workspace.productionLive ? "On" : "Off"}</p>
          <p className="text-sm text-slate-400">Production factory publish</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("baseline", () => postAction("capture_baseline"))}
          className="rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
        >
          {busy === "baseline" ? "Capturing live site…" : "Capture live baseline"}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("local", () => postAction("capture_local_baseline"))}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200"
        >
          Snapshot this local server
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("checks", () => postAction("run_conversions"))}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200"
        >
          Run conversion tests
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("stage", () => postAction("deploy_staging", { approvedBy: operator }))}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200"
        >
          Push approved drafts to staging
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Live baseline hits sitesinc.co only. It does not deploy, rewrite, or take production offline.
      </p>
    </div>
  );
}

function Pipeline({
  workspace,
  busy,
  operator,
  onRun,
}: {
  workspace: FactoryWorkspace;
  busy: string;
  operator: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  return (
    <div className="space-y-3">
      {workspace.stages.map((stage) => (
        <div key={stage.key} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Stage {stage.order}</p>
              <h2 className="text-lg font-semibold text-white">{stage.name}</h2>
            </div>
            <Pill status={stage.status}>{stage.status.replace(/_/g, " ")}</Pill>
          </div>
          <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Required inputs</p>
              <ul className="mt-1 list-disc pl-4">
                {stage.requiredInputs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Artifacts</p>
              <ul className="mt-1 list-disc pl-4">
                {stage.artifacts.length ? stage.artifacts.map((item) => <li key={item}>{item}</li>) : <li>None yet</li>}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-400">{stage.notes || "No notes."}</p>
          <p className="mt-1 text-xs text-slate-500">
            Approval: {stage.operatorApproval ? `yes · ${stage.approvedBy} · ${stage.approvedAt}` : "not approved"}
            {stage.completedAt ? ` · completed ${stage.completedAt}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["in_progress", "ready_for_review", "complete"] as StageStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  onRun(stage.key, () => postAction("patch_stage", { key: stage.key, status }))
                }
                className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-200"
              >
                Mark {status.replace(/_/g, " ")}
              </button>
            ))}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                onRun(stage.key, () =>
                  postAction("patch_stage", { key: stage.key, approve: true, approvedBy: operator })
                )
              }
              className="rounded-lg bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-100"
            >
              Operator approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BaselinePanel({
  payload,
  busy,
  onRun,
}: {
  payload: Payload;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  const { baseline, workspace } = payload;
  const [label, setLabel] = useState("Homepage desktop");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("viewport", viewport);
    form.append("label", label);
    const res = await fetch("/api/factory/screenshots", { method: "POST", body: form });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("baseline", () => postAction("capture_baseline"))}
          className="rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Recapture live sitesinc.co
        </button>
      </div>
      {!baseline && <p className="text-slate-400">No baseline yet. Capture the live site first.</p>}
      {baseline && (
        <>
          <div className={card}>
            <p className="text-sm text-slate-400">
              {baseline.source} · {baseline.origin} · {baseline.capturedAt}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Robots: {baseline.robotsTxt.ok ? "ok" : baseline.robotsTxt.error}. Sitemap:{" "}
              {baseline.sitemap.ok ? `${baseline.sitemap.urls.length} urls` : baseline.sitemap.error}. Broken links:{" "}
              {baseline.brokenLinks.length}. Avg TTFB: {baseline.performance.avgTtfbMs ?? "—"}ms (not Lighthouse).
            </p>
            <p className="mt-2 text-sm text-slate-400">{baseline.indexing.note}</p>
            <p className="text-sm text-slate-400">{baseline.analytics.note}</p>
            <p className="mt-2 text-sm text-slate-300">
              Intake: {baseline.intakeFormHealth.launchBlocking ? "launch blocking" : "healthy enough to keep working"}.{" "}
              {baseline.intakeFormHealth.notes.join(" ")}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Words</th>
                  <th className="px-3 py-2">H1</th>
                  <th className="px-3 py-2">Schema</th>
                </tr>
              </thead>
              <tbody>
                {baseline.pageInventory.map((page) => (
                  <tr key={page.path} className="border-t border-white/5">
                    <td className="px-3 py-2 text-brand-200">{page.path}</td>
                    <td className="px-3 py-2">{page.statusCode ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{page.title || page.error}</td>
                    <td className="px-3 py-2">{page.wordCount}</td>
                    <td className="px-3 py-2">{page.headings.h1.join(" · ") || "—"}</td>
                    <td className="px-3 py-2">{page.schemaTypes.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className={card}>
        <h3 className="font-semibold text-white">Screenshot references</h3>
        <p className="mt-1 text-sm text-slate-400">Upload desktop or mobile captures. Do not upload admin screens or private client data.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10"
          />
          <select
            value={viewport}
            onChange={(e) => setViewport(e.target.value as "desktop" | "mobile")}
            className="rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10"
          >
            <option value="desktop">desktop</option>
            <option value="mobile">mobile</option>
          </select>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              onRun("upload", () => upload(file));
            }}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {workspace.screenshots.map((shot) => (
            <figure key={shot.id} className="overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.url} alt={shot.label} className="h-32 w-full object-cover" />
              <figcaption className="px-3 py-2 text-xs text-slate-400">
                {shot.viewport} · {shot.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResearchPanel({ workspace }: { workspace: FactoryWorkspace }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Clusters are useful pages, not doorway spam. City/industry duplicates are explicitly out of scope.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {workspace.clusters.map((cluster) => (
          <div key={cluster.id} className={card}>
            <h3 className="font-semibold text-white">{cluster.topic}</h3>
            <p className="mt-1 text-sm text-slate-300">{cluster.intent}</p>
            <p className="mt-2 text-xs text-brand-300">Hub {cluster.hubPath}</p>
            <p className="mt-2 text-sm text-slate-400">{cluster.notes}</p>
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className="font-semibold text-white">Page blueprint</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {workspace.blueprint.map((page) => (
            <li key={page.slug} className="flex flex-wrap justify-between gap-2 border-b border-white/5 pb-2">
              <span>
                <span className="text-white">{page.title}</span>
                <span className="ml-2 text-slate-500">{page.path}</span>
                <p className="text-slate-400">{page.purpose}</p>
              </span>
              <Pill status={page.existing ? "complete" : "in_progress"}>
                {page.existing ? "live — do not overwrite" : "proposed"}
              </Pill>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BriefsPanel({
  workspace,
  operator,
  busy,
  onRun,
}: {
  workspace: FactoryWorkspace;
  operator: string;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        A brief is required before drafting. Word counts are guidance. Human approval is required before publish.
      </p>
      {workspace.briefs.map((brief) => (
        <BriefCard key={brief.id} brief={brief} operator={operator} busy={busy} onRun={onRun} />
      ))}
    </div>
  );
}

function BriefCard({
  brief,
  operator,
  busy,
  onRun,
}: {
  brief: ContentBrief;
  operator: string;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{brief.title}</h3>
        <Pill status={brief.status}>{brief.status.replace(/_/g, " ")}</Pill>
      </div>
      <p className="mt-2 text-sm text-slate-300">{brief.searchIntent}</p>
      <p className="mt-2 text-xs text-slate-500">
        Word count guidance: {brief.wordCountGuidance.min}–{brief.wordCountGuidance.max}. {brief.wordCountGuidance.note}
      </p>
      <p className="mt-2 text-sm text-slate-400">Competitors: {brief.competitorUrls.join(" · ")}</p>
      <p className="mt-2 text-sm text-slate-300">Gaps: {brief.gaps.join(" ")}</p>
      <ol className="mt-2 list-decimal pl-5 text-sm text-slate-300">
        {brief.outline.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            onRun(brief.id, () =>
              postAction("patch_brief", { id: brief.id, status: "approved", approvedBy: operator })
            )
          }
          className="rounded-lg bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-100"
        >
          Approve brief
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            onRun(brief.id, () => postAction("patch_brief", { id: brief.id, status: "rejected" }))
          }
          className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-200"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function DraftsPanel({
  workspace,
  operator,
  busy,
  onRun,
}: {
  workspace: FactoryWorkspace;
  operator: string;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  return (
    <div className="space-y-4">
      {workspace.pages.map((page) => (
        <DraftCard key={page.slug} page={page} briefs={workspace.briefs} operator={operator} busy={busy} onRun={onRun} />
      ))}
    </div>
  );
}

function DraftCard({
  page,
  briefs,
  operator,
  busy,
  onRun,
}: {
  page: FactoryPage;
  briefs: ContentBrief[];
  operator: string;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  const brief = briefs.find((b) => b.slug === page.slug);
  const [title, setTitle] = useState(page.title);
  const [meta, setMeta] = useState(page.metaDescription);
  const [body, setBody] = useState(page.body);
  useEffect(() => {
    setTitle(page.title);
    setMeta(page.metaDescription);
    setBody(page.body);
  }, [page.title, page.metaDescription, page.body]);
  const blocked = brief?.status !== "approved";

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{page.path}</h3>
        <Pill status={page.status}>{page.status.replace(/_/g, " ")}</Pill>
      </div>
      {blocked && (
        <p className="mt-2 text-sm text-amber-100">Brief must be approved before this page can be written.</p>
      )}
      <input
        value={title}
        disabled={blocked}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-3 w-full rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10 disabled:opacity-50"
      />
      <input
        value={meta}
        disabled={blocked}
        onChange={(e) => setMeta(e.target.value)}
        placeholder="Meta description"
        className="mt-2 w-full rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10 disabled:opacity-50"
      />
      <textarea
        value={body}
        disabled={blocked}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder="Draft in plain language. Use ## for headings. Word count is guidance, not the goal."
        className="mt-2 w-full rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10 disabled:opacity-50"
      />
      <p className="mt-1 text-xs text-slate-500">{body.trim() ? body.trim().split(/\s+/).length : 0} words</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={blocked || Boolean(busy)}
          onClick={() =>
            onRun(page.slug, () =>
              postAction("patch_page", {
                slug: page.slug,
                title,
                metaDescription: meta,
                body,
                status: "ready_for_review",
              })
            )
          }
          className="rounded-lg bg-white/10 px-3 py-1 text-xs"
        >
          Save for review
        </button>
        <button
          type="button"
          disabled={blocked || Boolean(busy)}
          onClick={() =>
            onRun(page.slug, () =>
              postAction("patch_page", {
                slug: page.slug,
                title,
                metaDescription: meta,
                body,
                status: "approved",
                approvedBy: operator,
              })
            )
          }
          className="rounded-lg bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-100"
        >
          Human approve draft
        </button>
      </div>
    </div>
  );
}

function SeoPanel({
  workspace,
  preflight,
  disclaimers,
  operator,
  busy,
  onRun,
}: {
  workspace: FactoryWorkspace;
  preflight: PreflightItem[];
  disclaimers: Record<string, string>;
  operator: string;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{disclaimers.production}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {preflight.map((item) => (
          <div key={item.id} className={card}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-white">{item.label}</h3>
              <Pill status={item.status}>{item.status.replace(/_/g, " ")}</Pill>
            </div>
            <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("stage", () => postAction("deploy_staging", { approvedBy: operator }))}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm"
        >
          Deploy to staging (noindex)
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            onRun("prod", () => postAction("deploy_production", { approvedBy: operator, notes: "Explicit production approval" }))
          }
          className="rounded-xl bg-brand-500/20 px-4 py-2 text-sm font-semibold text-brand-100"
        >
          Approve production publish
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun("rollback", () => postAction("rollback", { approvedBy: operator }))}
          className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-100"
        >
          Rollback factory pages
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Production publish only adds approved factory URLs. Homepage, blog, and shop stay as they are. Rollback removes those new URLs.
      </p>
      {workspace.deployments.length > 0 && (
        <div className={card}>
          <h3 className="font-semibold text-white">Deploy log</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {workspace.deployments.slice().reverse().map((dep) => (
              <li key={dep.id}>
                {dep.environment} · {dep.createdAt} · {dep.approvedBy} · {dep.notes}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IndexingPanel({
  workspace,
  busy,
  onRun,
}: {
  workspace: FactoryWorkspace;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  const states: IndexingState[] = [
    "not_submitted",
    "submitted",
    "discovered",
    "crawled",
    "indexed",
    "excluded_error",
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Submission does not guarantee indexing. Last checked date and source are shown on each row. Search Console is used only when credentials exist.
      </p>
      {workspace.indexing.map((row) => (
        <div key={row.path} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{row.path}</p>
              <p className="text-xs text-slate-500">
                {row.source} · last checked {row.lastChecked}
              </p>
            </div>
            <Pill status={row.state}>{row.state.replace(/_/g, " ")}</Pill>
          </div>
          <p className="mt-2 text-sm text-slate-400">{row.notes}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {states.map((state) => (
              <button
                key={state}
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  onRun(row.path, () => postAction("patch_indexing", { path: row.path, state }))
                }
                className="rounded-lg bg-white/10 px-2 py-1 text-xs"
              >
                {state.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BacklinksPanel({
  workspace,
  busy,
  onRun,
}: {
  workspace: FactoryWorkspace;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  const [form, setForm] = useState({
    referringDomain: "",
    destinationUrl: "https://sitesinc.co/",
    anchor: "",
    relevance: "",
    qualityNotes: "",
    acquisitionMethod: "earned / manual outreach",
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Ethical tracker only. Do not add spam networks or invent links that were not earned.
      </p>
      <div className={`${card} grid gap-2 sm:grid-cols-2`}>
        {Object.entries(form).map(([key, value]) => (
          <input
            key={key}
            value={value}
            placeholder={key}
            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            className="rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10"
          />
        ))}
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() =>
            onRun("backlink", async () => {
              const next = await postAction("add_backlink", form);
              setForm((prev) => ({ ...prev, referringDomain: "", anchor: "", relevance: "", qualityNotes: "" }));
              return next;
            })
          }
          className="rounded-xl bg-brand-500/20 px-4 py-2 text-sm font-semibold text-brand-100"
        >
          Record earned link
        </button>
      </div>
      {workspace.backlinks.length === 0 && (
        <p className="text-sm text-slate-500">No backlinks recorded. That is an in-progress state, not a fake zero-authority claim.</p>
      )}
      {workspace.backlinks.map((row: BacklinkRecord) => (
        <div key={row.id} className={card}>
          <p className="font-semibold text-white">{row.referringDomain}</p>
          <p className="text-sm text-slate-300">
            {row.destinationUrl} · “{row.anchor}”
          </p>
          <p className="text-sm text-slate-400">{row.qualityNotes} · {row.acquisitionMethod}</p>
          <div className="mt-2 flex gap-2">
            <Pill status={row.status}>{row.status}</Pill>
            {(["active", "lost", "pending"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onRun(row.id, () => postAction("patch_backlink", { id: row.id, status }))}
                className="text-xs text-brand-300"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversionsPanel({
  workspace,
  busy,
  onRun,
}: {
  workspace: FactoryWorkspace;
  busy: string;
  onRun: (label: string, work: () => Promise<Payload | void>) => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => onRun("checks", () => postAction("run_conversions"))}
        className="rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2 text-sm font-semibold text-zinc-950"
      >
        Run conversion tests
      </button>
      {workspace.conversions.launchBlocking && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Launch-blocking issue detected. Production deploy is locked until this is green.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {workspace.conversions.checks.map((check) => (
          <div key={check.id} className={card}>
            <div className="flex justify-between gap-2">
              <h3 className="font-semibold text-white">{check.label}</h3>
              <Pill status={check.severity}>{check.ok ? "ok" : check.severity.replace(/_/g, " ")}</Pill>
            </div>
            <p className="mt-2 text-sm text-slate-300">{check.detail}</p>
            <p className="mt-1 text-xs text-slate-500">{check.lastRun}</p>
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className="font-semibold text-white">Recorded events</h3>
        {workspace.conversions.events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">None yet. Checklist signup success records an event automatically.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {workspace.conversions.events.slice(0, 20).map((event) => (
              <li key={event.id}>
                {event.type} · {event.path} · {event.createdAt}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CaseStudyPanel({
  workspace,
  baseline,
  preflight,
}: {
  workspace: FactoryWorkspace;
  baseline: BaselineSnapshot | null;
  preflight: PreflightItem[];
}) {
  const published = workspace.pages.filter((p) => p.status === "published");
  const afterReady = published.length > 0;
  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        Outcome numbers that are not measured are labeled in progress. Nothing here is a ranking, traffic, or revenue guarantee.
      </p>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Before</h2>
        {baseline ? (
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            <li>Origin {baseline.origin} captured {baseline.capturedAt}</li>
            <li>{baseline.pageInventory.length} pages inventoried</li>
            <li>Sitemap {baseline.sitemap.ok ? "present" : "missing"} · robots {baseline.robotsTxt.ok ? "present" : "missing"}</li>
            <li>Broken links: {baseline.brokenLinks.length}</li>
            <li>Avg TTFB {baseline.performance.avgTtfbMs ?? "—"}ms · Lighthouse in progress</li>
          </ul>
        ) : (
          <p className="mt-2 text-sm text-amber-100">In progress — capture a live baseline.</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {workspace.screenshots.map((shot) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={shot.id} src={shot.url} alt={shot.label} className="rounded-lg border border-white/10" />
          ))}
        </div>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Factory process</h2>
        <ol className="mt-3 space-y-2">
          {workspace.stages.map((stage) => (
            <li key={stage.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-200">
                {stage.order}. {stage.name}
              </span>
              <Pill status={stage.status}>{stage.status.replace(/_/g, " ")}</Pill>
            </li>
          ))}
        </ol>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">After</h2>
        {afterReady ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-300">
            {published.map((page) => (
              <li key={page.slug}>
                {page.path} published {page.publishedAt}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-amber-100">
            In progress — no factory pages are on production yet. The current public site is unchanged.
          </p>
        )}
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Timeline</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          <li>Project created {workspace.project.createdAt}</li>
          {workspace.deployments.map((dep) => (
            <li key={dep.id}>
              {dep.environment} {dep.createdAt}
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Technical improvements</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {preflight.map((item) => (
            <li key={item.id}>
              {item.label}: {item.status.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Content produced</h2>
        <p className="mt-2 text-sm text-slate-300">
          {workspace.briefs.filter((b) => b.status === "approved").length} briefs approved ·{" "}
          {workspace.pages.filter((p) => p.body.trim()).length} drafts with copy
        </p>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Indexing progress</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {workspace.indexing.map((row) => (
            <li key={row.path}>
              {row.path}: {row.state.replace(/_/g, " ")} ({row.source})
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Backlinks earned</h2>
        {workspace.backlinks.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-300">
            {workspace.backlinks.map((row) => (
              <li key={row.id}>
                {row.referringDomain} → {row.destinationUrl} ({row.status})
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-amber-100">In progress — none recorded.</p>
        )}
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold text-white">Search and conversion results</h2>
        <p className="mt-2 text-sm text-amber-100">
          In progress — no Search Console or GA numeric import is wired. Conversion checks last ran{" "}
          {workspace.conversions.lastRun || "never"}. Launch blocking:{" "}
          {workspace.conversions.launchBlocking ? "yes" : "no"}.
        </p>
      </section>
    </div>
  );
}
