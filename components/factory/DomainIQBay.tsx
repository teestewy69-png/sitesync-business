"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClientDomainCandidate } from "@/lib/domainiq/client";
import type { DomainBackfillResult, DomainBaySummary } from "@/lib/factory/domainiq";
import AffiliateDisclosure from "@/components/siteflow/AffiliateDisclosure";
import { getProgram, outboundHref, plainRegistrarUrl, REGISTRAR_SLUGS, SPONSORED_REL } from "@/lib/affiliates";

type TryResult = { candidates: ClientDomainCandidate[]; meta?: { nicheKey: string | null } };

export default function DomainIQBay({
  summary,
  siteflowEnabled = false,
}: {
  summary: DomainBaySummary;
  /** SiteFlow paused (Path A, default): registrar links are plain, untracked, internal-only search URLs. */
  siteflowEnabled?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ businessName: "", niche: "plumbing", city: "", state: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<TryResult | null>(null);
  const [verify, setVerify] = useState(summary.availabilityEnabled);
  const [backfill, setBackfill] = useState<DomainBackfillResult | null>(null);

  async function fireUp() {
    setBusy("backfill");
    setError("");
    try {
      const res = await fetch("/api/factory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "domainiq-backfill", approvedBy: "Tony" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; domainBackfill?: DomainBackfillResult };
      if (!res.ok || !data.ok || !data.domainBackfill) throw new Error(data.error || "DomainIQ backfill failed");
      setBackfill(data.domainBackfill);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "DomainIQ backfill failed");
    } finally {
      setBusy("");
    }
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
      const data = (await res.json()) as { ok?: boolean; error?: string } & TryResult;
      if (!res.ok || !data.ok) throw new Error(data.error || "DomainIQ failed");
      setResult({ candidates: data.candidates, meta: data.meta });
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
      setResult({
        ...result,
        candidates: result.candidates.map((c) => {
          const hit = byDomain.get(c.domain);
          return hit ? { ...c, availability: hit.status, availabilityDetail: hit.detail } : c;
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Availability check failed");
    } finally {
      setBusy("");
    }
  }

  const field = (key: keyof typeof form, placeholder: string, width = "w-36") => (
    <input
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      placeholder={placeholder}
      className={`${width} rounded-lg bg-black/40 px-2 py-1 text-sm text-white ring-1 ring-white/10`}
    />
  );

  return (
    <section className="mt-10 rounded-2xl border border-brand-400/30 bg-white/5 p-5" id="domainiq-bay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Factory bay</p>
          <h2 className="mt-1 text-xl font-semibold">DomainIQ · client domains</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Factory only — not on the public site. Runs automatically for every new client project (after setup,
            like the auto baseline): generates and scores domain candidates from niche, business name and city, then
            checks availability via free public RDAP + DNS. Operator picks; Tony signs off; purchase stays manual.
            Engine {summary.engine} · {summary.mode} · no server, no API key · availability{" "}
            {summary.availabilityEnabled ? "on (keyless)" : "off"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">live</span>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={fireUp}
            className="rounded-lg bg-gradient-to-b from-brand-300 to-brand-600 px-3 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            {busy === "backfill" ? "Firing up…" : "Fire up DomainIQ"}
          </button>
        </div>
      </div>
      {backfill ? (
        <p className="mt-3 text-sm text-slate-300">
          Backfill: scanned {backfill.scanned}, generated {backfill.generated}, skipped {backfill.skipped}
          {backfill.errors.length ? `, ${backfill.errors.length} errors` : ""}. Clients who already own a domain stay skipped.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
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
        <ul className="mt-4 space-y-1 text-sm">
          {summary.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2">
              <Link href={`/app/clients/${row.id}#domainiq`} className="text-brand-300 hover:underline">
                {row.name}
              </Link>
              <span className="text-xs text-slate-400">
                {row.status}
                {row.selectedDomain
                  ? ` · picked ${row.selectedDomain}`
                  : row.topDomain
                    ? ` · top ${row.topDomain} (${row.topScore?.toFixed(2)})`
                    : ""}
                {` · ${row.candidates} candidates`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No client projects yet.</p>
      )}

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm font-semibold text-white">Try the bay (not saved)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {field("niche", "niche e.g. plumbing")}
          {field("businessName", "business name", "w-52")}
          {field("city", "city")}
          {field("state", "state", "w-16")}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={generate}
            className="rounded-lg bg-gradient-to-b from-brand-300 to-brand-600 px-3 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            {busy === "generate" ? "Generating…" : "Generate + score"}
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={verify}
              disabled={!summary.availabilityEnabled}
              onChange={(e) => setVerify(e.target.checked)}
            />
            verify availability over the ranked pool (RDAP/DNS)
          </label>
          <button
            type="button"
            disabled={Boolean(busy) || !result?.candidates.length || !summary.availabilityEnabled}
            onClick={checkAvailability}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-60"
          >
            {busy === "availability" ? "Checking…" : "Check availability"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-amber-200">{error}</p> : null}
        {result ? (
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {result.candidates.map((c) => (
              <li key={c.domain} className="rounded-lg border border-white/10 px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white">{c.domain}</span>
                  <span className="text-xs text-slate-400">
                    {c.score.toFixed(2)} · {c.source} · {c.availability}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px]">
                  {REGISTRAR_SLUGS.map((slug) => (
                    <a
                      key={slug}
                      href={
                        siteflowEnabled
                          ? outboundHref("", slug, { domain: c.domain, src: "domainiq-bay" })
                          : plainRegistrarUrl(slug, c.domain)
                      }
                      rel={siteflowEnabled ? SPONSORED_REL : "noopener noreferrer"}
                      target="_blank"
                      className="text-brand-300 hover:underline"
                    >
                      {getProgram(slug)?.name || slug}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {result?.candidates.length ? (
          siteflowEnabled ? (
            <AffiliateDisclosure className="mt-2" />
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Internal only: plain registrar search links (no affiliate tracking). Domain purchase stays manual.
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}
