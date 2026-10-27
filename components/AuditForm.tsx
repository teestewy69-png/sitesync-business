"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import type { AuditCheck, AuditResult } from "@/lib/site-audit";
import { trackEvent } from "@/lib/analytics";

const STYLE = {
  pass: { icon: CheckCircle2, color: "text-emerald-400", label: "Looks good" },
  warn: { icon: AlertTriangle, color: "text-amber-300", label: "Could be better" },
  fail: { icon: XCircle, color: "text-rose-400", label: "Needs work" },
} as const;

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setResult(null);
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
