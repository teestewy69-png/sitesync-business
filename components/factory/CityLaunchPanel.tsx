"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PickedCity } from "@/lib/city-launch/cities";
import type { CityDraft, CityIndexEntry, CityLaunchIndex } from "@/lib/city-launch/job";
import type { LlmProviderStatus } from "@/lib/city-launch/llm";
import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_TARGET_WORDS,
  DEFAULT_TITLE_TEMPLATE,
  faqToText,
  linesToList,
  sectionsToText,
  textToFaq,
  textToSections,
} from "@/lib/city-launch/prompts";

type Summary = {
  provider: LlmProviderStatus;
  index: CityLaunchIndex | null;
  activeBatch:
    | (Record<string, unknown> & {
        id: string;
        status: string;
        createdAt: string;
        ticks: number;
        lastProgressAt?: string;
        lease?: { until: string } | null;
        log: string[];
        settings: { concurrency: number; requestsPerMinute: number; maxAttempts: number; keyword: string };
        provider: { envKey: string; model: string } | null;
        counts: { total: number; queued: number; generating: number; drafted: number; failed: number; cancelled: number; retrying: number };
        failedItems: Array<{ slug: string; name: string; state: string; lastError?: string; attempts: number; nextAttemptAt?: string }>;
      })
    | null;
  counts: { total: number; queued: number; generating: number; failed: number; draft: number; approved: number; rejected: number; blocked: number; warned: number };
};

type Defaults = {
  businessName: string;
  niche: string;
  baseCity: string;
  baseState: string;
  baseInDataset: boolean;
  websiteContent: string;
  selectedDomain?: string;
};

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/factory/city-launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown> & { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || "City Launch request failed");
  return data;
}

const input = "rounded-lg bg-black/40 px-2 py-1 text-sm text-white ring-1 ring-white/10";
const btn = "rounded-full bg-brand-400/90 px-3 py-1 text-xs font-semibold text-black hover:bg-brand-300 disabled:opacity-40";
const ghost = "rounded-full border border-white/15 px-3 py-1 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40";

function gateTone(status?: string) {
  if (status === "pass") return "bg-emerald-500/15 text-emerald-200";
  if (status === "warn") return "bg-amber-500/15 text-amber-100";
  if (status === "block") return "bg-red-500/15 text-red-200";
  return "bg-white/10 text-slate-400";
}

function statusTone(status: string) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-200";
  if (status === "draft") return "bg-sky-500/15 text-sky-200";
  if (status === "failed" || status === "rejected") return "bg-red-500/15 text-red-200";
  if (status === "generating" || status === "queued") return "bg-amber-500/15 text-amber-100";
  return "bg-white/10 text-slate-300";
}

export default function CityLaunchPanel({
  projectId,
  initial,
  defaults,
}: {
  projectId: string;
  initial: Summary;
  defaults: Defaults;
}) {
  const [summary, setSummary] = useState<Summary>(initial);
  const [approver, setApprover] = useState("Tony");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // picking
  const [mode, setMode] = useState<"radius" | "top_states" | "csv">(defaults.baseInDataset ? "radius" : "top_states");
  const [origin, setOrigin] = useState({ city: defaults.baseCity, state: defaults.baseState });
  const [miles, setMiles] = useState(30);
  const [limit, setLimit] = useState(25);
  const [minPop, setMinPop] = useState(0);
  const [states, setStates] = useState(defaults.baseState || "");
  const [csv, setCsv] = useState("");
  const [picked, setPicked] = useState<PickedCity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickInfo, setPickInfo] = useState<{ detail: string; issues: Array<{ row: number; message: string }> }>({ detail: "", issues: [] });

  // writing settings
  const [settings, setSettings] = useState({
    keyword: defaults.niche,
    titleTemplate: DEFAULT_TITLE_TEMPLATE,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    competitorGaps: "",
    websiteContent: defaults.websiteContent,
    localFacts: "",
    targetWordCount: DEFAULT_TARGET_WORDS,
    includeFaq: true,
    concurrency: 4,
    requestsPerMinute: 40,
  });

  // review
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openSlug, setOpenSlug] = useState("");
  const [draft, setDraft] = useState<CityDraft | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [signoffBy, setSignoffBy] = useState("Tony");

  const provider = summary.provider;
  const batch = summary.activeBatch;
  const running = batch && (batch.status === "running" || batch.status === "queued");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/factory/city-launch?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    const data = (await res.json()) as Summary & { ok?: boolean; error?: string };
    if (res.ok && data.ok) setSummary(data);
    return data;
  }, [projectId]);

  // Poll while a batch is active; resume (tick) when its lease has expired and nothing moved for 45s.
  const lastKick = useRef(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const data = await refresh().catch(() => null);
      const b = data?.activeBatch;
      if (!b || (b.status !== "running" && b.status !== "queued")) return;
      const leaseOver = !b.lease || Date.parse(b.lease.until) < Date.now();
      const idleMs = Date.now() - Date.parse(b.lastProgressAt || b.createdAt);
      if (leaseOver && idleMs > 45_000 && Date.now() - lastKick.current > 30_000) {
        lastKick.current = Date.now();
        await fetch("/api/factory/city-launch/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, batchId: b.id }),
        }).catch(() => undefined);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [running, refresh, projectId]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const pick = () =>
    run("pick", async () => {
      const request =
        mode === "radius"
          ? { mode, originCity: origin.city, originState: origin.state, miles, limit, minPopulation: minPop }
          : mode === "top_states"
            ? { mode, states: states.split(/[,\s]+/).filter(Boolean), limit, minPopulation: minPop }
            : { mode, csv };
      const data = (await api({ op: "pick", projectId, request })) as unknown as {
        cities: PickedCity[];
        detail: string;
        issues: Array<{ row: number; message: string }>;
      };
      setPicked(data.cities);
      setSelected(new Set(data.cities.map((c) => c.slug)));
      setPickInfo({ detail: data.detail, issues: data.issues || [] });
    });

  const queue = () =>
    run("queue", async () => {
      const cities = picked.filter((c) => selected.has(c.slug));
      const data = (await api({
        op: "queue",
        projectId,
        approvedBy: approver,
        batch: {
          ...settings,
          cities: cities.map((c) => ({ name: c.name, state: c.state, slug: c.slug, keyword: c.keyword, notes: c.notes, distanceMiles: c.distanceMiles })),
          pickMode: mode,
          pickDetail: pickInfo.detail,
        },
      })) as { skipped?: Array<{ slug: string; reason: string }> };
      setNotice(`Queued. ${data.skipped?.length ? `${data.skipped.length} skipped (${data.skipped.slice(0, 3).map((s) => `${s.slug}: ${s.reason}`).join("; ")})` : ""}`);
      setPicked([]);
      await refresh();
    });

  const control = (action: string) =>
    run(action, async () => {
      if (!batch) return;
      await api({ op: "control", projectId, batchId: batch.id, action, approvedBy: approver });
      await refresh();
    });

  const pages = useMemo(() => {
    const all = Object.values(summary.index?.pages || {}) as CityIndexEntry[];
    return all
      .filter((p) =>
        filter === "all"
          ? true
          : filter === "blocked"
            ? p.gate?.status === "block" && p.status !== "rejected"
            : filter === "ready"
              ? p.status === "draft" && p.gate && p.gate.status !== "block"
              : p.status === filter
      )
      .filter((p) => !search || `${p.name} ${p.state} ${p.title || ""}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.state.localeCompare(b.state) || b.population - a.population);
  }, [summary.index, filter, search]);

  const readyToApprove = useMemo(
    () => (Object.values(summary.index?.pages || {}) as CityIndexEntry[]).filter((p) => p.status === "draft" && p.gate && p.gate.status !== "block"),
    [summary.index]
  );

  async function openDraft(slug: string) {
    if (openSlug === slug) {
      setOpenSlug("");
      setDraft(null);
      return;
    }
    await run(`open-${slug}`, async () => {
      const res = await fetch(`/api/factory/city-launch?projectId=${encodeURIComponent(projectId)}&slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; error?: string; draft?: CityDraft };
      if (!res.ok || !data.ok || !data.draft) throw new Error(data.error || "Draft not found");
      const c = data.draft.content;
      setDraft(data.draft);
      setOpenSlug(slug);
      setEdit({
        title: c.title,
        metaDescription: c.metaDescription,
        h1: c.h1,
        heroSubhead: c.heroSubhead,
        intro: c.intro,
        sections: sectionsToText(c.sections),
        localHighlights: c.localHighlights.join("\n"),
        faq: faqToText(c.faq),
        ctaHeadline: c.ctaHeadline,
        ctaText: c.ctaText,
        serviceArea: c.serviceArea || "",
      });
    });
  }

  const saveEdit = () =>
    run("save", async () => {
      await api({
        op: "edit",
        projectId,
        slug: openSlug,
        approvedBy: approver,
        edit: {
          title: edit.title,
          metaDescription: edit.metaDescription,
          h1: edit.h1,
          heroSubhead: edit.heroSubhead,
          intro: edit.intro,
          ctaHeadline: edit.ctaHeadline,
          ctaText: edit.ctaText,
          serviceArea: edit.serviceArea,
          sections: textToSections(edit.sections || ""),
          localHighlights: linesToList(edit.localHighlights || ""),
          faq: textToFaq(edit.faq || ""),
        },
      });
      setNotice("Saved. Edited pages need a fresh approval; the gate was re-run.");
      await refresh();
    });

  const approve = (slugs: string[]) =>
    run(`approve-${slugs.length}`, async () => {
      const data = (await api({ op: "approve", projectId, slugs, approvedBy: approver })) as { approved: string[]; refused: Array<{ slug: string; reason: string }> };
      setNotice(`Approved ${data.approved.length}.${data.refused.length ? ` Refused ${data.refused.length}: ${data.refused.slice(0, 3).map((r) => `${r.slug} (${r.reason})`).join("; ")}` : ""}`);
      await refresh();
    });

  const regenerate = (slug: string) =>
    run(`regen-${slug}`, async () => {
      await api({ op: "regenerate", projectId, slug, approvedBy: approver });
      setNotice(`Regenerated ${slug}.`);
      if (openSlug === slug) {
        setOpenSlug("");
        setDraft(null);
      }
      await refresh();
    });

  const reject = (slug: string) => run(`reject-${slug}`, async () => { await api({ op: "reject", projectId, slug, approvedBy: approver }); await refresh(); });
  const reopen = (slug: string) => run(`reopen-${slug}`, async () => { await api({ op: "reopen", projectId, slug, approvedBy: approver }); await refresh(); });
  const regate = () => run("gate", async () => { const d = (await api({ op: "gate", projectId })) as { gate: { checked: number; blocked: number; warned: number } }; setNotice(`Gate: ${d.gate.checked} checked, ${d.gate.blocked} blocked, ${d.gate.warned} warned.`); await refresh(); });
  const signoff = () => run("signoff", async () => { await api({ op: "signoff-production", projectId, approvedBy: signoffBy }); await refresh(); });
  const revoke = () => run("revoke", async () => { await api({ op: "revoke-production", projectId, approvedBy: signoffBy }); await refresh(); });

  const counts = summary.counts;
  const bc = batch?.counts;
  const done = bc ? bc.drafted + bc.failed - bc.retrying + bc.cancelled : 0;
  const pct = bc && bc.total ? Math.round((done / bc.total) * 100) : 0;
  const selectedCount = picked.filter((c) => selected.has(c.slug)).length;
  const production = summary.index?.production;

  return (
    <section className="mt-6 rounded-2xl border border-brand-400/30 p-5" id="city-launch">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Factory bay</p>
          <h2 className="text-lg font-semibold">City Launch · animated city landing pages</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Pick real U.S. cities (Census data), queue up to 500 per batch, and the factory writes a unique, locally grounded
            landing page for each with an LLM (rate-limited, retried, resumable). Every page must pass the quality gate
            (near-duplicate + substance check) before a human can approve it. Approved pages appear on the client preview
            automatically; the client&apos;s real domain needs Tony&apos;s sign-off and the manual production deploy.
          </p>
        </div>
        <label className="text-xs text-slate-400">
          Approver{" "}
          <input value={approver} onChange={(e) => setApprover(e.target.value)} className={`${input} w-28`} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {provider.configured ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-200">
            LLM: {provider.envKey} · {provider.label} · {provider.model}
          </span>
        ) : (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-200">LLM key missing</span>
        )}
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{counts.total} pages</span>
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-200">{counts.draft} drafts</span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">{counts.approved} approved (live on preview)</span>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-200">{counts.blocked} gate-blocked</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-100">{counts.warned} gate warnings</span>
        {counts.failed ? <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-200">{counts.failed} failed</span> : null}
      </div>
      {!provider.configured ? (
        <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{provider.detail}</p>
      ) : null}
      {error ? <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100">{error}</p> : null}
      {notice ? <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{notice}</p> : null}

      {/* 1. Pick */}
      <div className="mt-5 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">1 · Pick cities</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["radius", "Within X miles"],
              ["top_states", "Top N in state(s)"],
              ["csv", "CSV paste"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMode(id)} className={mode === id ? btn : ghost}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 text-xs text-slate-400">
          {mode === "radius" ? (
            <>
              <label>Origin city<br /><input value={origin.city} onChange={(e) => setOrigin({ ...origin, city: e.target.value })} className={`${input} w-36`} /></label>
              <label>State<br /><input value={origin.state} onChange={(e) => setOrigin({ ...origin, state: e.target.value })} className={`${input} w-14`} /></label>
              <label>Miles<br /><input type="number" value={miles} onChange={(e) => setMiles(Number(e.target.value))} className={`${input} w-20`} /></label>
            </>
          ) : null}
          {mode === "top_states" ? (
            <label>States (comma separated)<br /><input value={states} onChange={(e) => setStates(e.target.value)} placeholder="AZ, NV" className={`${input} w-48`} /></label>
          ) : null}
          {mode !== "csv" ? (
            <>
              <label>Max cities (≤500)<br /><input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${input} w-24`} /></label>
              <label>Min population<br /><input type="number" value={minPop} onChange={(e) => setMinPop(Number(e.target.value))} className={`${input} w-28`} /></label>
            </>
          ) : (
            <label className="w-full">
              Paste rows: <code>city,state[,keyword,competitor_gaps,website_content]</code> (ScaleQuan template) or <code>City, ST</code> per line
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} className={`${input} mt-1 w-full font-mono`} placeholder={"city,state,keyword\nMesa,AZ,emergency plumber\nTempe,AZ"} />
            </label>
          )}
          <button type="button" onClick={pick} disabled={Boolean(busy)} className={btn}>
            {busy === "pick" ? "Finding…" : "Find cities"}
          </button>
        </div>
        {!defaults.baseInDataset && defaults.baseCity ? (
          <p className="mt-2 text-xs text-amber-100">Client city “{defaults.baseCity}, {defaults.baseState}” is not in the Census incorporated-place dataset - enter the nearest city as origin.</p>
        ) : null}
        {pickInfo.detail ? <p className="mt-3 text-xs text-slate-400">{pickInfo.detail} · {selectedCount} selected</p> : null}
        {pickInfo.issues.length ? (
          <ul className="mt-2 max-h-28 overflow-auto text-xs text-amber-100">
            {pickInfo.issues.slice(0, 30).map((i, n) => (
              <li key={n}>row {i.row}: {i.message}</li>
            ))}
          </ul>
        ) : null}
        {picked.length ? (
          <>
            <div className="mt-2 flex gap-2">
              <button type="button" className={ghost} onClick={() => setSelected(new Set(picked.map((c) => c.slug)))}>Select all</button>
              <button type="button" className={ghost} onClick={() => setSelected(new Set())}>Select none</button>
            </div>
            <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-black text-slate-500">
                  <tr><th className="px-2 py-1"></th><th className="px-2 py-1">City</th><th className="px-2 py-1">County</th><th className="px-2 py-1">Population (2024)</th><th className="px-2 py-1">Miles</th><th className="px-2 py-1">Source</th></tr>
                </thead>
                <tbody>
                  {picked.map((c) => (
                    <tr key={c.slug} className="border-t border-white/5">
                      <td className="px-2 py-1">
                        <input type="checkbox" checked={selected.has(c.slug)} onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(c.slug); else next.delete(c.slug); setSelected(next); }} />
                      </td>
                      <td className="px-2 py-1 text-slate-200">{c.name}, {c.state}{c.keyword ? <span className="text-slate-500"> · {c.keyword}</span> : null}</td>
                      <td className="px-2 py-1 text-slate-400">{c.county || "-"}</td>
                      <td className="px-2 py-1 text-slate-400">{c.population ? c.population.toLocaleString() : "-"}</td>
                      <td className="px-2 py-1 text-slate-400">{c.distanceMiles ?? "-"}</td>
                      <td className="px-2 py-1 text-slate-500">{c.source === "dataset" ? "Census" : "CSV only"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      {/* 2. Write */}
      <div className="mt-4 rounded-xl border border-white/10 p-4">
        <h3 className="text-sm font-semibold text-white">2 · Writing job (ScaleQuan templates)</h3>
        <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
          <label>Keyword<input value={settings.keyword} onChange={(e) => setSettings({ ...settings, keyword: e.target.value })} className={`${input} mt-1 w-full`} /></label>
          <label>Title template<input value={settings.titleTemplate} onChange={(e) => setSettings({ ...settings, titleTemplate: e.target.value })} className={`${input} mt-1 w-full font-mono`} /></label>
          <label className="md:col-span-2">AI prompt / instructions<textarea value={settings.promptTemplate} onChange={(e) => setSettings({ ...settings, promptTemplate: e.target.value })} rows={2} className={`${input} mt-1 w-full`} /></label>
          <label>Competitor gaps to cover<textarea value={settings.competitorGaps} onChange={(e) => setSettings({ ...settings, competitorGaps: e.target.value })} rows={3} className={`${input} mt-1 w-full`} placeholder="Topics competitors skip, e.g. how pricing works, what to expect on the first visit… (not proof of a business claim)" /></label>
          <label>Business / website context (only facts stated here can appear as business claims)<textarea value={settings.websiteContent} onChange={(e) => setSettings({ ...settings, websiteContent: e.target.value })} rows={3} className={`${input} mt-1 w-full`} /></label>
          <label className="md:col-span-2">Verified local notes, with sources (optional; the ONLY allowed source for climate, water, soil, housing-age or regulation statements, otherwise the page leaves them out)<textarea value={settings.localFacts} onChange={(e) => setSettings({ ...settings, localFacts: e.target.value })} rows={2} className={`${input} mt-1 w-full`} placeholder="e.g. Mesa water hardness ~ 14 grains/gallon (City of Mesa 2025 Water Quality Report)" /></label>
          <div className="flex flex-wrap items-end gap-3 md:col-span-2">
            <label>Target words<br /><input type="number" value={settings.targetWordCount} onChange={(e) => setSettings({ ...settings, targetWordCount: Number(e.target.value) })} className={`${input} w-24`} /></label>
            <label>Concurrency<br /><input type="number" min={1} max={8} value={settings.concurrency} onChange={(e) => setSettings({ ...settings, concurrency: Number(e.target.value) })} className={`${input} w-20`} /></label>
            <label>Requests / min<br /><input type="number" min={1} max={600} value={settings.requestsPerMinute} onChange={(e) => setSettings({ ...settings, requestsPerMinute: Number(e.target.value) })} className={`${input} w-24`} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeFaq} onChange={(e) => setSettings({ ...settings, includeFaq: e.target.checked })} /> Include FAQ</label>
            <button type="button" onClick={queue} disabled={!provider.configured || !selectedCount || selectedCount > 500 || Boolean(busy)} className={btn} title={provider.configured ? "" : "LLM key missing"}>
              {busy === "queue" ? "Queueing…" : `Queue ${selectedCount} cit${selectedCount === 1 ? "y" : "ies"}`}
            </button>
            {selectedCount > 500 ? <span className="text-red-200">Max 500 per batch.</span> : null}
          </div>
        </div>
      </div>

      {/* 3. Progress */}
      {batch ? (
        <div className="mt-4 rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              3 · Batch {batch.id} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${statusTone(batch.status === "running" ? "generating" : batch.status.startsWith("completed") ? "approved" : batch.status)}`}>{batch.status}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {running ? <button type="button" className={ghost} onClick={() => control("pause")} disabled={Boolean(busy)}>Pause</button> : null}
              {batch.status === "paused" || batch.status === "blocked_missing_key" || running ? (
                <button type="button" className={ghost} onClick={() => control("resume")} disabled={Boolean(busy)}>Resume</button>
              ) : null}
              {bc && (bc.failed > 0 || bc.cancelled > 0) ? <button type="button" className={ghost} onClick={() => control("retry_failed")} disabled={Boolean(busy)}>Retry failed</button> : null}
              {running || batch.status === "paused" ? <button type="button" className={ghost} onClick={() => control("cancel")} disabled={Boolean(busy)}>Cancel</button> : null}
              <button type="button" className={ghost} onClick={() => void refresh()}>Refresh</button>
            </div>
          </div>
          {bc ? (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-brand-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {bc.drafted}/{bc.total} drafted · {bc.generating} writing · {bc.queued} queued · {bc.retrying} waiting to retry · {bc.failed - bc.retrying} failed · {bc.cancelled} cancelled ·
                {" "}ticks {batch.ticks} · concurrency {batch.settings.concurrency} · {batch.settings.requestsPerMinute} req/min · {batch.settings.maxAttempts} attempts ·
                {" "}{batch.provider ? `${batch.provider.envKey} / ${batch.provider.model}` : ""}
              </p>
            </>
          ) : null}
          {batch.failedItems.length ? (
            <ul className="mt-2 max-h-28 overflow-auto text-xs text-red-200">
              {batch.failedItems.map((f) => (
                <li key={f.slug}>{f.name}, {f.state}: {f.lastError} (attempt {f.attempts}{f.nextAttemptAt ? `, retry ${new Date(f.nextAttemptAt).toLocaleTimeString()}` : ""})</li>
              ))}
            </ul>
          ) : null}
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer">Job log</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">{batch.log.slice(-20).join("\n")}</pre>
          </details>
        </div>
      ) : null}

      {/* 4. Review */}
      {counts.total ? (
        <div className="mt-4 rounded-xl border border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">4 · Review, edit, regenerate, approve</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className={input}>
                {["all", "ready", "draft", "approved", "blocked", "failed", "queued", "generating", "rejected"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search city" className={`${input} w-32`} />
              <button type="button" className={ghost} onClick={regate} disabled={Boolean(busy)}>Re-run gate</button>
              <button type="button" className={btn} disabled={!readyToApprove.length || Boolean(busy)} onClick={() => approve(readyToApprove.map((p) => p.slug))}>
                Approve {readyToApprove.length} gate-passing drafts
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gate score = highest masked 5-word-shingle overlap with any other page of this client (place names and numbers masked, so a find-and-replace clone scores 1.0). ≥ 0.35 blocks; ≥ 0.18 warns.
            {summary.index?.gateRunAt ? ` Last run ${new Date(summary.index.gateRunAt).toLocaleString()}.` : ""}
          </p>
          <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-black text-slate-500">
                <tr><th className="px-2 py-1">City</th><th className="px-2 py-1">Title</th><th className="px-2 py-1">Words</th><th className="px-2 py-1">Gate</th><th className="px-2 py-1">Status</th><th className="px-2 py-1"></th></tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <Fragment key={p.slug}>
                    <tr className="border-t border-white/5 align-top">
                      <td className="px-2 py-1 text-slate-200">{p.name}, {p.state}</td>
                      <td className="px-2 py-1 text-slate-300">{p.title || (p.lastError ? <span className="text-red-200">{p.lastError}</span> : "-")}</td>
                      <td className="px-2 py-1 text-slate-400">{p.words ?? "-"}</td>
                      <td className="px-2 py-1">
                        {p.gate ? (
                          <span className={`rounded-full px-2 py-0.5 ${gateTone(p.gate.status)}`} title={p.gate.reasons.join(" ")}>
                            {p.gate.status} · {p.gate.maxScore.toFixed(3)}{p.gate.nearestSlug ? ` vs ${p.gate.nearestSlug}` : ""}
                          </span>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 ${gateTone()}`}>-</span>
                        )}
                      </td>
                      <td className="px-2 py-1"><span className={`rounded-full px-2 py-0.5 ${statusTone(p.status)}`}>{p.status}</span></td>
                      <td className="whitespace-nowrap px-2 py-1">
                        {p.status === "draft" || p.status === "approved" || p.status === "rejected" ? (
                          <>
                            <button type="button" className="text-brand-300 hover:underline" onClick={() => void openDraft(p.slug)}>{openSlug === p.slug ? "Close" : "Review"}</button>{" · "}
                            <a className="text-brand-300 hover:underline" href={`/demo/client/${projectId}/locations/${p.slug}${p.status === "approved" ? "" : "?preview=1"}`} target="_blank" rel="noreferrer">Preview</a>{" · "}
                          </>
                        ) : null}
                        {p.status === "draft" && p.gate?.status !== "block" ? (<><button type="button" className="text-emerald-300 hover:underline" disabled={Boolean(busy)} onClick={() => approve([p.slug])}>Approve</button>{" · "}</>) : null}
                        {p.status !== "queued" && p.status !== "generating" ? (<><button type="button" className="text-slate-300 hover:underline" disabled={!provider.configured || Boolean(busy)} onClick={() => regenerate(p.slug)}>{busy === `regen-${p.slug}` ? "Writing…" : "Regenerate"}</button></>) : null}
                        {p.status === "draft" || p.status === "approved" ? (<>{" · "}<button type="button" className="text-red-300 hover:underline" disabled={Boolean(busy)} onClick={() => reject(p.slug)}>Reject</button></>) : null}
                        {p.status === "rejected" ? (<>{" · "}<button type="button" className="text-slate-300 hover:underline" onClick={() => reopen(p.slug)}>Reopen</button></>) : null}
                      </td>
                    </tr>
                    {openSlug === p.slug && draft ? (
                      <tr className="border-t border-white/5">
                        <td colSpan={6} className="px-3 py-3">
                          {p.gate?.reasons.length ? <p className="mb-2 text-xs text-amber-100">Gate: {p.gate.reasons.join(" ")}</p> : null}
                          <p className="mb-2 text-xs text-slate-500">
                            {draft.city.county || "-"} · pop {draft.city.population ? draft.city.population.toLocaleString() : "?"} · nearby {draft.nearby.map((n) => n.name).join(", ") || "-"} · {draft.model} via {draft.providerEnvKey} · generation {draft.generations}
                            {draft.editedAt ? ` · edited by ${draft.editedBy}` : ""}{draft.approvedBy ? ` · approved by ${draft.approvedBy}` : ""}
                          </p>
                          <div className="grid gap-2 md:grid-cols-2">
                            {(["title", "metaDescription", "h1", "heroSubhead", "ctaHeadline", "ctaText"] as const).map((k) => (
                              <label key={k} className="text-xs text-slate-400">{k}{k === "metaDescription" ? ` (${(edit[k] || "").length}/155)` : ""}
                                <input value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className={`${input} mt-1 w-full`} />
                              </label>
                            ))}
                            <label className="text-xs text-slate-400 md:col-span-2">service area (county + nearby cities)<textarea value={edit.serviceArea || ""} onChange={(e) => setEdit({ ...edit, serviceArea: e.target.value })} rows={2} className={`${input} mt-1 w-full`} /></label>
                            <label className="text-xs text-slate-400 md:col-span-2">intro<textarea value={edit.intro || ""} onChange={(e) => setEdit({ ...edit, intro: e.target.value })} rows={3} className={`${input} mt-1 w-full`} /></label>
                            <label className="text-xs text-slate-400 md:col-span-2">sections (## Heading, then body)<textarea value={edit.sections || ""} onChange={(e) => setEdit({ ...edit, sections: e.target.value })} rows={14} className={`${input} mt-1 w-full font-mono`} /></label>
                            <label className="text-xs text-slate-400">local highlights (one per line)<textarea value={edit.localHighlights || ""} onChange={(e) => setEdit({ ...edit, localHighlights: e.target.value })} rows={5} className={`${input} mt-1 w-full`} /></label>
                            <label className="text-xs text-slate-400">FAQ (Q: / A: blocks)<textarea value={edit.faq || ""} onChange={(e) => setEdit({ ...edit, faq: e.target.value })} rows={5} className={`${input} mt-1 w-full`} /></label>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button type="button" className={btn} onClick={saveEdit} disabled={Boolean(busy)}>{busy === "save" ? "Saving…" : "Save edit"}</button>
                            <button type="button" className={ghost} onClick={() => regenerate(p.slug)} disabled={!provider.configured || Boolean(busy)}>Regenerate</button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 5. Publish */}
      <div className="mt-4 rounded-xl border border-white/10 p-4 text-sm">
        <h3 className="text-sm font-semibold text-white">5 · Publish</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          <li>
            <strong className="text-slate-200">Preview (automatic):</strong> approved + gate-passing pages render at{" "}
            <a className="text-brand-300 hover:underline" href={`/demo/client/${projectId}/locations`} target="_blank" rel="noreferrer">/demo/client/{projectId}/locations</a> and are listed in{" "}
            <a className="text-brand-300 hover:underline" href={`/demo/client/${projectId}/sitemap.xml`} target="_blank" rel="noreferrer">sitemap.xml</a>. On the Sitesinc Netlify site this is live the moment a page is approved (no rebuild; read from Blobs). Preview stays noindex.
          </li>
          <li>
            <strong className="text-slate-200">Client&apos;s real domain (sign-off + Netlify domain alias):</strong> needs a selected domain ({defaults.selectedDomain || "none yet"}) and Tony&apos;s sign-off below.
            Once the domain is added as a domain alias on the Sitesinc Netlify site and its DNS points there (manual, see docs/per-client-factory.md), the site serves
            home, approved pages, /locations, every approved city page, sitemap.xml and robots.txt on that domain, indexable, with canonicals on the client&apos;s domain.
            Nothing is deployed or changed on Netlify from here. Revoking takes the domain offline (404) immediately.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {production?.status === "signed_off" ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
              Signed off by {production.signedOffBy} · {production.pageCount} pages · {production.domain} · {production.signedOffAt?.slice(0, 16)}
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">
              Production sign-off: {production?.status === "revoked" ? `revoked by ${production.revokedBy || "?"} · ${production.revokedAt?.slice(0, 16) || ""}` : "not requested"}
            </span>
          )}
          <input value={signoffBy} onChange={(e) => setSignoffBy(e.target.value)} className={`${input} w-28`} />
          <button type="button" className={ghost} onClick={signoff} disabled={!counts.approved || !defaults.selectedDomain || Boolean(busy)}>
            Record Tony&apos;s production sign-off ({counts.approved} pages)
          </button>
          {production?.status === "signed_off" ? (
            <>
              <a className="text-brand-300 hover:underline" href={`/demo/client/${projectId}/sitemap.xml?target=production`} target="_blank" rel="noreferrer">production sitemap</a>
              <button type="button" className={ghost} onClick={revoke} disabled={Boolean(busy)}>
                Revoke (take {production.domain} offline)
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
