"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import type { AuditCheck, AuditResult } from "@/lib/site-audit";
import type { DeepAuditResult } from "@/lib/deep-audit";
import { trackEvent } from "@/lib/analytics";

const STYLE = {
  pass: { icon: CheckCircle2, color: "text-emerald-400", label: "Looks good" },
  warn: { icon: AlertTriangle, color: "text-amber-300", label: "Could be better" },
  fail: { icon: XCircle, color: "text-rose-400", label: "Needs work" },
} as const;

type DeepOk = Extract<DeepAuditResult, { ok: true }>;

const SEVERITY = {
  high: { chip: "border-rose-400/30 bg-rose-500/10 text-rose-200", label: "High" },
  medium: { chip: "border-amber-300/30 bg-amber-400/10 text-amber-200", label: "Medium" },
  low: { chip: "border-white/15 bg-white/5 text-slate-300", label: "Low" },
} as const;

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [deep, setDeep] = useState<DeepOk | null>(null);
  const [deepState, setDeepState] = useState<"idle" | "running" | "done" | "failed">("idle");

  async function runDeep(target: string) {
    setDeep(null);
    setDeepState("running");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 75_000);
    try {
      const res = await fetch("/api/free-website-audit/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "The deep audit could not run.");
      setDeep(data as DeepOk);
      setDeepState("done");
      trackEvent("free_audit_deep_run", { score: (data as DeepOk).score });
    } catch {
      setDeepState("failed");
    } finally {
      clearTimeout(timer);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setDeep(null);
    setDeepState("idle");
    try {
      const res = await fetch("/api/free-website-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
      setResult(data as AuditResult);
      trackEvent("free_audit_run", { checks_passed: (data as AuditResult).passed });
      void runDeep(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const problems = result ? result.checks.filter((c) => c.status !== "pass") : [];

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row" noValidate>
        <label htmlFor="audit-url" className="sr-only">Your website address</label>
        <input
          id="audit-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourbusiness.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-brand-300 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Checking…" : "Check my website"}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-400">
        We load the page you enter once and read what comes back. We don&apos;t store your address or ask for an email.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-6" aria-live="polite">
          <h2 className="text-xl font-semibold text-white">
            {result.passed} of {result.total} checks passed
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Checked {new Date(result.checkedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {result.finalUrl}
          </p>
          <ul className="mt-4 space-y-3">
            {result.checks.map((c: AuditCheck) => {
              const s = STYLE[c.status];
              const Icon = s.icon;
              return (
                <li key={c.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.color}`} aria-hidden />
                  <div>
                    <p className="font-semibold text-white">
                      {c.label} <span className={`text-sm font-medium ${s.color}`}>· {s.label}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{c.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {deepState === "running" ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4" aria-live="polite">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-300" aria-hidden />
              <p className="text-sm text-slate-300">
                Quick checks done. The deep audit is now crawling your whole site — up to 10 pages — scoring it and checking
                every page&apos;s details. This takes a few seconds.
              </p>
            </div>
          ) : null}
          {deepState === "failed" ? (
            <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              The deep audit couldn&apos;t finish for this site — some sites block crawlers, or take too long to crawl. The
              quick checks above still stand.
            </p>
          ) : null}
          {deepState === "done" && deep ? (
            <div className="mt-8" aria-live="polite">
              <h3 className="text-xl font-semibold text-white">
                Deep audit: health score{" "}
                <span className={deep.score >= 80 ? "text-emerald-400" : deep.score >= 50 ? "text-amber-300" : "text-rose-400"}>
                  {deep.score}/100
                </span>
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                We crawled {deep.pagesCrawled} {deep.pagesCrawled === 1 ? "page" : "pages"} and found{" "}
                {deep.counts.high + deep.counts.medium + deep.counts.low} things to look at: {deep.counts.high} high,{" "}
                {deep.counts.medium} medium, {deep.counts.low} low priority.
              </p>
              {deep.phones.length || deep.addresses.length ? (
                <p className="mt-2 text-sm text-slate-300">
                  Published on the site — phone: {deep.phones.length ? deep.phones.join(", ") : "none found"} · address:{" "}
                  {deep.addresses.length ? deep.addresses.join("; ") : "none found"}
                </p>
              ) : null}
              <ul className="mt-4 space-y-3">
                {deep.findings.map((f) => (
                  <li key={`${f.severity}|${f.issue}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-semibold text-white">
                      <span className={`mr-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY[f.severity].chip}`}>
                        {SEVERITY[f.severity].label}
                      </span>
                      {f.issue}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{f.fix}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {f.pages > 1 ? `Seen on ${f.pages} pages.` : f.firstPage !== "site" ? `On ${f.firstPage}.` : "Across the site."}
                    </p>
                  </li>
                ))}
              </ul>
              {deep.findings.length >= 10 ? (
                <p className="mt-3 text-sm text-slate-400">Those are the 10 to fix first — the rest follow the same patterns.</p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-4 text-sm text-slate-400">
            For a deeper speed test, run the same page through{" "}
            <a className="text-brand-300 hover:underline" href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(result.finalUrl)}`} target="_blank" rel="noopener noreferrer">
              Google PageSpeed Insights
            </a>
            .
          </p>
          <div className="mt-6 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-5">
            <p className="text-lg font-semibold text-white">
              {problems.length ? `${problems.length} ${problems.length === 1 ? "item" : "items"} to fix.` : "Your basics look solid."} Want a real, working website built for you?
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Sitesinc builds it for a flat $1,995, one time. 50% to start, 50% at launch. No long-term contract, and you own your website.
            </p>
            <a
              href="/contact#contact-form"
              data-analytics-cta="audit_request_build"
              className="mt-4 inline-flex rounded-xl bg-brand-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-400"
            >
              Request a website build
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
