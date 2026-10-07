"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientDomainCandidate, ClientDomainStatus } from "@/lib/domainiq/client";
import type { ClientDomainIQState } from "@/lib/store";

async function runAction(op: string, fields: Record<string, string>) {
  const res = await fetch("/api/factory/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...fields }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) throw new Error(data.error || "Action failed");
}

function availabilityTone(status: ClientDomainCandidate["availability"]) {
  if (status === "available") return "bg-emerald-500/15 text-emerald-200";
  if (status === "registered") return "bg-red-500/15 text-red-200";
  if (status === "error") return "bg-amber-500/15 text-amber-100";
  return "bg-white/10 text-slate-300";
}

function bandTone(band: string) {
  if (band === "excellent") return "text-emerald-200";
  if (band === "strong") return "text-brand-300";
  if (band === "moderate") return "text-amber-100";
  return "text-red-200";
}

export default function DomainIQPanel({
  projectId,
  candidates,
  selectedDomain,
  domainStatus,
  state,
  seedPreview,
}: {
  projectId: string;
  candidates: ClientDomainCandidate[];
  selectedDomain?: string;
  domainStatus?: ClientDomainStatus;
  state?: ClientDomainIQState;
  seedPreview: { businessName: string; niche: string; city: string; state: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [operator, setOperator] = useState("Tony");
  const [custom, setCustom] = useState("");

  async function run(label: string, op: string, fields: Record<string, string> = {}) {
    setBusy(label);
    setError("");
    try {
      await runAction(op, { projectId, ...fields });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  const seed = state?.seed || seedPreview;
  const status = domainStatus || "not_run";

  return (
    <section className="mt-6 rounded-2xl border border-white/10 p-5" id="domainiq">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">DomainIQ · domain bay</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Auto-seeded from niche <strong className="text-slate-200">{seed.niche || "-"}</strong>, business{" "}
            <strong className="text-slate-200">{seed.businessName || "-"}</strong>, city{" "}
            <strong className="text-slate-200">{[seed.city, seed.state].filter(Boolean).join(", ") || "-"}</strong>.
            Scores are DomainIQ&apos;s own engine (in-process, no server or key). Availability uses free public
            RDAP + DNS. <strong className="text-amber-100">Sitesinc never buys a domain</strong> - purchase is
            manual after Tony signs off.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200">status {status}</span>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run("generate", "domainiq-generate", { force: "1" })}
            className="rounded-lg bg-gradient-to-b from-brand-300 to-brand-600 px-3 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
          >
            {busy === "generate" ? "Generating…" : candidates.length ? "Regenerate" : "Generate candidates"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !candidates.length || state?.availability?.enabled === false}
            onClick={() => run("availability", "domainiq-check-availability")}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-60"
          >
            {busy === "availability" ? "Checking…" : "Check availability"}
          </button>
        </div>
      </div>

      {state?.reason ? <p className="mt-3 text-xs text-slate-400">{state.reason}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        engine {state?.engine || "-"} · generated {state?.generatedAt || "-"} · availability{" "}
        {state?.availability?.enabled === false
          ? "disabled (unchecked)"
          : state?.availability?.checkedAt
            ? `checked ${state.availability.checkedAt} (${state.availability.detail || "-"})`
            : state?.availability?.detail || "not checked yet"}
      </p>

      {selectedDomain ? (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm">
          <p className="text-slate-200">
            Selected: <strong className="text-white">{selectedDomain}</strong>
            {state?.selectedBy ? ` by ${state.selectedBy}` : ""}
            {state?.selectedAt ? ` · ${state.selectedAt}` : ""}
          </p>
          {state?.selectionWarning ? <p className="mt-1 text-xs text-amber-100">{state.selectionWarning}</p> : null}
          {status === "client_owned" ? (
            <p className="mt-1 text-xs text-emerald-200">
              The client already owns this domain. No purchase or purchase sign-off needed; suggestions are not
              auto-generated.
            </p>
          ) : status === "purchase_approved" ? (
            <p className="mt-1 text-xs text-emerald-200">
              Purchase signed off by {state?.purchaseApprovedBy} at {state?.purchaseApprovedAt}. Buy it manually at a
              registrar - nothing was purchased by Sitesinc.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-400">
                Sign-off name
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="ml-2 rounded-lg bg-black/40 px-2 py-1 text-sm text-white ring-1 ring-white/10"
                />
              </label>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => run("approve", "domainiq-approve-purchase", { approvedBy: operator })}
                className="rounded-lg border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-200 disabled:opacity-60"
              >
                {busy === "approve" ? "Saving…" : "Record purchase sign-off (no purchase)"}
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => run("clear", "domainiq-clear-selection")}
                className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300 disabled:opacity-60"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}

      {candidates.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-3">Domain</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Availability</th>
                <th className="py-2 pr-3">Why</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {candidates.map((c) => (
                <tr key={c.domain} className={c.domain === selectedDomain ? "bg-emerald-400/5" : ""}>
                  <td className="py-2 pr-3 font-medium text-white">{c.domain}</td>
                  <td className={`py-2 pr-3 font-semibold ${bandTone(c.band)}`}>
                    {c.score.toFixed(2)} <span className="text-xs font-normal text-slate-500">{c.band}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-300">{c.source}</td>
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
                    {c.concerns.length ? <span className="block text-amber-100/80">{c.concerns.join("; ")}</span> : null}
                  </td>
                  <td className="py-2 text-right">
                    {c.domain === selectedDomain ? (
                      <span className="text-xs text-emerald-200">selected</span>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => run(`pick:${c.domain}`, "domainiq-select", { domain: c.domain, approvedBy: operator })}
                        className="rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-60"
                      >
                        {busy === `pick:${c.domain}` ? "…" : "Pick"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-amber-100">
          {status === "pending"
            ? "Queued - DomainIQ candidates are generated automatically right after setup. Refresh in a moment."
            : status === "missing_input"
              ? "Needs client input: add a niche or business name, then Regenerate."
              : "No candidates yet. Generate to run DomainIQ for this client."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="client-owned or preferred domain, e.g. desertflowplumbing.com"
          className="w-80 rounded-lg bg-black/40 px-2 py-1 text-sm text-white ring-1 ring-white/10"
        />
        <button
          type="button"
          disabled={Boolean(busy) || !custom.trim()}
          onClick={() => run("custom", "domainiq-select", { domain: custom.trim(), approvedBy: operator })}
          className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-100 disabled:opacity-60"
        >
          {busy === "custom" ? "Scoring…" : "Score + pick this domain"}
        </button>
      </div>
    </section>
  );
}
