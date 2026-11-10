"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ClientDomainCandidate } from "@/lib/domainiq/client";
import type { DomainBaySummary } from "@/lib/factory/domainiq";
import AffiliateDisclosure from "@/components/siteflow/AffiliateDisclosure";
import { getProgram, outboundHref, plainRegistrarUrl, REGISTRAR_SLUGS, SPONSORED_REL } from "@/lib/affiliates";

/**
 * Standalone DomainIQ generator (Tony, 2026-11-09: "build a stand alone").
 *
 * The DomainIQ bay on the factory home only counts client projects, so with no
 * clients it reads as empty. This page is the generator itself: type a business,
 * get scored candidates + a keyless RDAP/DNS availability pass, score any single
 * domain, and keep the runs. Runs are saved in this browser (localStorage) so a
 * refresh does not wipe them; per-client generation still lives on each client's
 * DomainIQ panel, and purchase stays manual - Sitesinc never buys a domain.
 */

const RUNS_KEY = "sitesinc-domainiq-runs-v1";
const MAX_SAVED_RUNS = 20;

type GeneratorForm = { businessName: string; niche: string; city: string; state: string };

type GeneratorResult = {
  form: GeneratorForm;
  candidates: ClientDomainCandidate[];
  meta?: { nicheKey: string | null };
  availabilityChecked: number;
  generatedAt: string;
};

type SavedRun = GeneratorResult & { id: string; savedAt: string };

type ScoreResult = {
  fullName: string;
  total: number;
  band: string;
  summary: string;
  explanation: string;
  highlights: string[];
  concerns: string[];
  subScores: Record<string, number>;
};

function availabilityTone(status: ClientDomainCandidate["availability"]) {
  if (status === "available") return "bg-emerald-500/15 text-emerald-200";
  if (status === "registered") return "bg-red-500/15 text-red-200";
  if (status === "error") return "bg-amber-500/15 text-amber-100";
  return "bg-white/10 text-slate-300";
}

function bandTone(band: string) {
  if (band === "excellent") return "text-emerald-200";
  if (band === "strong") return "text-sky-300";
  if (band === "moderate") return "text-amber-100";
  return "text-red-200";
}

function parseSavedRuns(raw: string): SavedRun[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedRun[];
    return Array.isArray(parsed) ? parsed.filter((r) => r && Array.isArray(r.candidates)) : [];
  } catch {
    return [];
  }
}

function loadSavedRuns(): SavedRun[] {
  try {
    return parseSavedRuns(window.localStorage.getItem(RUNS_KEY) || "");
  } catch {
    return [];
  }
}

/** Saved runs live in localStorage; useSyncExternalStore keeps the list in sync without an effect. */
const RUNS_EVENT = "sitesinc-domainiq-runs-changed";

function subscribeRuns(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(RUNS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RUNS_EVENT, onChange);
  };
}

function getRunsSnapshot(): string {
  try {
    return window.localStorage.getItem(RUNS_KEY) || "";
  } catch {
    return "";
  }
}

function getServerRunsSnapshot(): string {
  return "";
}

function candidatesCsv(candidates: ClientDomainCandidate[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["domain", "score", "band", "source", "availability", "summary"].map(esc).join(","),
    ...candidates.map((c) =>
      [c.domain, c.score.toFixed(2), c.band, c.source, c.availability, c.summary].map(esc).join(",")
    ),
  ];
  return rows.join("\n");
}

export default function DomainIQStandalone({
  engine,
  availabilityEnabled,
  siteflowEnabled = false,
  niches,
  summary,
}: {
  engine: string;
  availabilityEnabled: boolean;
  siteflowEnabled?: boolean;
  niches: Array<{ key: string; displayName: string }>;
  summary: DomainBaySummary;
}) {
  const [form, setForm] = useState<GeneratorForm>({ businessName: "", niche: "", city: "", state: "" });
  const [verify, setVerify] = useState(availabilityEnabled);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const runsRaw = useSyncExternalStore(subscribeRuns, getRunsSnapshot, getServerRunsSnapshot);
  const savedRuns = useMemo(() => parseSavedRuns(runsRaw), [runsRaw]);

  const [scoreDomain, setScoreDomain] = useState("");
  const [scoreBusy, setScoreBusy] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);

  function persistRuns(runs: SavedRun[]) {
    try {
      window.localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, MAX_SAVED_RUNS)));
    } catch {
      // Storage full/blocked: the run still shows on screen, it just will not persist.
    }
    window.dispatchEvent(new Event(RUNS_EVENT));
  }

  function saveRun(run: GeneratorResult) {
    const saved: SavedRun = { ...run, id: `${Date.now()}`, savedAt: new Date().toISOString() };
    persistRuns([saved, ...loadSavedRuns()]);
    return saved;
  }

  async function generate() {
    setBusy("generate");
    setError("");
    try {
      const res = await fetch("/api/factory/domainiq/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, checkAvailability: verify }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        candidates?: ClientDomainCandidate[];
        meta?: { nicheKey: string | null };
        availabilityChecked?: number;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "DomainIQ failed");
      const run: GeneratorResult = {
        form: { ...form },
        candidates: data.candidates || [],
        meta: data.meta,
        availabilityChecked: data.availabilityChecked || 0,
        generatedAt: new Date().toISOString(),
      };
      setResult(run);
      saveRun(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DomainIQ failed");
    } finally {
      setBusy("");
    }
  }

  async function checkAvailability() {
    if (!result) return;
    setBusy("availability");
    setError("");
    try {
      const res = await fetch("/api/factory/domainiq/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: result.candidates.slice(0, 12).map((c) => c.domain) }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ domain: string; status: ClientDomainCandidate["availability"]; detail?: string }>;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Availability check failed");
      const byDomain = new Map((data.results || []).map((r) => [r.domain, r]));
      const updated: GeneratorResult = {
        ...result,
        availabilityChecked: data.results?.length || result.availabilityChecked,
        candidates: result.candidates.map((c) => {
          const hit = byDomain.get(c.domain);
          return hit ? { ...c, availability: hit.status, availabilityDetail: hit.detail } : c;
        }),
      };
      setResult(updated);
      saveRun(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Availability check failed");
    } finally {
      setBusy("");
    }
  }

  async function scoreOne() {
    setScoreBusy(true);
    setScoreError("");
    try {
      const res = await fetch("/api/factory/domainiq/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: scoreDomain.trim(), niche: form.niche.trim() || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; score?: ScoreResult };
      if (!res.ok || !data.ok || !data.score) throw new Error(data.error || "Scoring failed");
      setScoreResult(data.score);
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoreBusy(false);
    }
  }

  function restoreRun(run: SavedRun) {
    setForm(run.form);
    setResult(run);
    setError("");
  }

  function downloadCsv() {
    if (!result) return;
    const blob = new Blob([candidatesCsv(result.candidates)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domainiq-${(result.form.businessName || "domains").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const topPick = result?.candidates.find((c) => c.availability === "available") || result?.candidates[0] || null;

  const field = (key: keyof GeneratorForm, label: string, placeholder: string) => (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        list={key === "niche" ? "domainiq-niches" : undefined}
        className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-sm text-white ring-1 ring-white/10"
      />
    </label>
  );

  return (
    <div>
      <p className="max-w-3xl text-lg text-zinc-300">
        The domain generator on its own page. Type a business, get scored domain names, check which ones are
        actually registerable, and pick one. Nothing here needs a client project first.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Engine {engine} · in-process, no server, no API key · availability{" "}
        {availabilityEnabled ? "on (keyless RDAP + DNS)" : "off (DOMAINIQ_AVAILABILITY=off)"} ·{" "}
        <strong className="text-amber-100">Sitesinc never buys a domain</strong> — purchase stays manual after your
        sign-off.
      </p>

      <section className="mt-8 rounded-2xl border border-sky-400/40 bg-sky-500/5 p-6">
        <h2 className="text-xl font-semibold text-sky-100">Generate domain names</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {field("businessName", "Business name *", "e.g. Sunrise Plumbing")}
          {field("niche", "What the business does *", "e.g. plumbing")}
          {field("city", "City", "e.g. Walnut")}
          {field("state", "State", "e.g. CA")}
        </div>
        <datalist id="domainiq-niches">
          {niches.map((n) => (
            <option key={n.key} value={n.key}>
              {n.displayName}
            </option>
          ))}
        </datalist>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={Boolean(busy) || !form.businessName.trim() || !form.niche.trim()}
            onClick={generate}
            className="rounded-lg bg-gradient-to-b from-sky-300 to-sky-600 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            {busy === "generate" ? "Generating…" : "Generate + score"}
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={verify}
              disabled={!availabilityEnabled}
              onChange={(e) => setVerify(e.target.checked)}
            />
            verify availability over the ranked pool (RDAP/DNS)
          </label>
          <button
            type="button"
            disabled={Boolean(busy) || !result?.candidates.length || !availabilityEnabled}
            onClick={checkAvailability}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          >
            {busy === "availability" ? "Checking…" : "Check availability"}
          </button>
          {result?.candidates.length ? (
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-100"
            >
              Download CSV
            </button>
          ) : null}
        </div>
        {!form.businessName.trim() || !form.niche.trim() ? (
          <p className="mt-2 text-xs text-slate-500">Business name and what it does are required — the rest sharpens the local names.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}

        {result && topPick ? (
          <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm">
            <p className="text-slate-200">
              {topPick.availability === "available" ? "Top verified-available pick: " : "Top scored (availability not verified): "}
              <strong className="text-white">{topPick.domain}</strong>{" "}
              <span className={bandTone(topPick.band)}>
                {topPick.score.toFixed(1)} · {topPick.band}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">{topPick.summary}</p>
            {result.availabilityChecked ? (
              <p className="mt-1 text-xs text-slate-500">
                Availability checked on {result.availabilityChecked} names ·{" "}
                {result.candidates.filter((c) => c.availability === "available").length} registerable in this list ·
                snapshot only, confirm at the registrar.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Availability was not checked for this run.</p>
            )}
          </div>
        ) : null}

        {result?.candidates.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Domain</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Availability</th>
                  <th className="py-2 pr-3">Why</th>
                  <th className="py-2">Register at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {result.candidates.map((c, i) => (
                  <tr key={c.domain}>
                    <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-3 font-medium text-white">{c.domain}</td>
                    <td className={`py-2 pr-3 font-semibold ${bandTone(c.band)}`}>
                      {c.score.toFixed(1)} <span className="text-xs font-normal text-slate-500">{c.band} · {c.source}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        title={c.availabilityDetail || ""}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${availabilityTone(c.availability)}`}
                      >
                        {c.availability}
                      </span>
                    </td>
                    <td className="max-w-xs py-2 pr-3 text-xs text-slate-400">
                      {c.summary}
                      {c.highlights.length ? <span className="block text-emerald-200/80">+ {c.highlights.join("; ")}</span> : null}
                      {c.concerns.length ? <span className="block text-amber-100/80">− {c.concerns.join("; ")}</span> : null}
                    </td>
                    <td className="py-2 text-xs">
                      {c.availability === "registered" ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-2">
                          {REGISTRAR_SLUGS.map((slug) => (
                            <a
                              key={slug}
                              href={
                                siteflowEnabled
                                  ? outboundHref("", slug, { domain: c.domain, src: "domainiq-standalone" })
                                  : plainRegistrarUrl(slug, c.domain)
                              }
                              rel={siteflowEnabled ? SPONSORED_REL : "noopener noreferrer"}
                              target="_blank"
                              className="text-sky-300 hover:underline"
                            >
                              {getProgram(slug)?.name || slug}
                            </a>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {siteflowEnabled ? (
              <AffiliateDisclosure className="mt-2" />
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Internal only: plain registrar search links (no affiliate tracking). Domain purchase stays manual.
              </p>
            )}
          </div>
        ) : result ? (
          <p className="mt-4 text-sm text-amber-100">That run produced no candidates. Try a shorter business name or a plainer trade word.</p>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No run yet. Fill in a business above and hit Generate — results land here and are saved below.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white">Score a single domain</h2>
        <p className="mt-1 text-sm text-slate-400">
          Already have a name in mind? Score it with the same engine (uses the trade above for niche fit, if set).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={scoreDomain}
            onChange={(e) => setScoreDomain(e.target.value)}
            placeholder="e.g. desertflowplumbing.com"
            className="w-80 rounded-lg bg-black/40 px-3 py-2 text-sm text-white ring-1 ring-white/10"
          />
          <button
            type="button"
            disabled={scoreBusy || !scoreDomain.trim()}
            onClick={scoreOne}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
          >
            {scoreBusy ? "Scoring…" : "Score it"}
          </button>
        </div>
        {scoreError ? <p className="mt-2 text-sm text-amber-200">{scoreError}</p> : null}
        {scoreResult ? (
          <div className="mt-3 text-sm">
            <p className="text-slate-200">
              <strong className="text-white">{scoreResult.fullName}</strong>{" "}
              <span className={`font-semibold ${bandTone(scoreResult.band)}`}>
                {scoreResult.total.toFixed(1)} · {scoreResult.band}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">{scoreResult.explanation}</p>
            <p className="mt-1 text-xs text-slate-500">
              {Object.entries(scoreResult.subScores)
                .map(([k, v]) => `${k.replace(/_/g, " ")} ${Number(v).toFixed(0)}`)
                .join(" · ")}
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-white">Saved runs</h2>
          {savedRuns.length ? (
            <button
              type="button"
              onClick={() => persistRuns([])}
              className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300"
            >
              Clear all
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Every generate saves here, in this browser, so a refresh does not wipe it. Newest first, last{" "}
          {MAX_SAVED_RUNS} runs.
        </p>
        {savedRuns.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {savedRuns.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
              >
                <button type="button" onClick={() => restoreRun(run)} className="text-left text-sky-300 hover:underline">
                  {run.form.businessName || "(no name)"} — {run.form.niche}
                  {[run.form.city, run.form.state].filter(Boolean).length
                    ? ` · ${[run.form.city, run.form.state].filter(Boolean).join(", ")}`
                    : ""}
                </button>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {run.candidates.length} names · top {run.candidates[0]?.domain || "—"} ·{" "}
                  {new Date(run.savedAt).toLocaleString()}
                  <button
                    type="button"
                    onClick={() => persistRuns(savedRuns.filter((r) => r.id !== run.id))}
                    className="rounded border border-white/15 px-2 py-0.5 text-slate-300"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Nothing saved yet — your first generate lands here.</p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white">Client projects</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          {[
            ["Clients", summary.clients],
            ["With candidates", summary.withCandidates],
            ["Picked (awaiting sign-off)", summary.selected],
            ["Purchase signed off", summary.purchaseApproved],
            ["Needs input / failed", summary.needsInput + summary.failed],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-white/10 px-3 py-2">
              <p className="text-2xl font-semibold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
        {summary.rows.length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {summary.rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
              >
                <Link href={`/app/clients/${row.id}#domainiq`} className="text-sky-300 hover:underline">
                  {row.name}
                </Link>
                <span className="text-xs text-slate-400">
                  {row.status}
                  {row.selectedDomain
                    ? ` · picked ${row.selectedDomain}`
                    : row.topDomain
                      ? ` · top ${row.topDomain} (${row.topScore?.toFixed(1)})`
                      : ""}
                  {` · ${row.candidates} candidates`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No client projects yet — that is why the old bay read as empty. The generator above works without one.
          </p>
        )}
      </section>
    </div>
  );
}
