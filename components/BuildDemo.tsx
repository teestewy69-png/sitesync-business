"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

type StepId = 0 | 1 | 2 | 3 | 4 | 5;

const STEPS: {
  id: StepId;
  label: string;
  detail: string;
  durationMs: number;
}[] = [
  {
    id: 0,
    label: "Scaffold",
    detail: "Next.js + Tailwind project spins up",
    durationMs: 1200,
  },
  {
    id: 1,
    label: "Load content",
    detail: "Business name, services, and keyword drop in",
    durationMs: 1600,
  },
  {
    id: 2,
    label: "Build hero",
    detail: "Call-first headline and primary CTA",
    durationMs: 1600,
  },
  {
    id: 3,
    label: "Add services",
    detail: "Plain-language offers visitors can act on",
    durationMs: 1400,
  },
  {
    id: 4,
    label: "Wire money pieces",
    detail: "Reviews, tap-to-call, Stripe-ready checkout",
    durationMs: 1500,
  },
  {
    id: 5,
    label: "Go live",
    detail: "SEO basics + Netlify hosting — you own the code",
    durationMs: 0,
  },
];

const DEMO = {
  business: "Smith Plumbing & Heating",
  keyword: "Emergency Plumber",
  tagline: "Fast, reliable plumbing help when you need it most.",
  cta: "Request Emergency Service",
  phone: "(555) 123-4567",
  services: [
    "24/7 Emergency Plumbing",
    "Leak Detection & Repair",
    "Water Heater Installation",
  ],
  quote: "They saved my basement at 2am. Incredible service.",
  quoteName: "Jane D.",
};

export default function BuildDemo() {
  const [step, setStep] = useState<StepId>(0);
  const [playing, setPlaying] = useState(true);
  const [runId, setRunId] = useState(0);
  const [typed, setTyped] = useState("");

  function jumpTo(id: StepId) {
    setPlaying(false);
    setStep(id);
    setTyped(id >= 1 ? DEMO.business : "");
  }

  function replay() {
    setPlaying(true);
    setStep(0);
    setTyped("");
    setRunId((n) => n + 1);
  }

  useEffect(() => {
    if (!playing || step >= 5) return;
    const ms = STEPS[step]?.durationMs ?? 1200;
    const t = window.setTimeout(() => {
      setStep((prev) => (prev < 5 ? ((prev + 1) as StepId) : prev));
    }, ms);
    return () => window.clearTimeout(t);
  }, [step, playing, runId]);

  useEffect(() => {
    if (step < 1) {
      setTyped("");
      return;
    }
    if (step === 1 && playing) {
      setTyped("");
      let i = 0;
      const full = DEMO.business;
      const t = window.setInterval(() => {
        i += 1;
        setTyped(full.slice(0, i));
        if (i >= full.length) window.clearInterval(t);
      }, 28);
      return () => window.clearInterval(t);
    }
    setTyped(DEMO.business);
  }, [step, playing, runId]);

  const showHero = step >= 2;
  const showServices = step >= 3;
  const showMoney = step >= 4;
  const showLive = step >= 5;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/10 via-white/[0.03] to-transparent">
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:gap-8 lg:p-8">
        <div className="flex shrink-0 flex-col justify-between gap-6 lg:w-[38%]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              Live build demo
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Watch a real client site assemble.
            </h3>
            <p className="text-base text-slate-400">
              Click a step to jump the preview, or hit replay to watch it build
              automatically.
            </p>
          </div>

          <div
            className="flex flex-wrap gap-2 lg:hidden"
            role="tablist"
            aria-label="Build steps"
          >
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={step === s.id}
                onClick={() => jumpTo(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  step === s.id
                    ? "bg-brand-400 text-zinc-950"
                    : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <ol className="hidden space-y-2 lg:block">
            {STEPS.map((s) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(s.id)}
                    className={`flex w-full gap-3 rounded-xl px-3 py-2 text-left transition ${
                      active
                        ? "bg-brand-500/15 ring-1 ring-brand-400/40"
                        : done
                          ? "opacity-90 hover:bg-white/5"
                          : "opacity-50 hover:bg-white/5 hover:opacity-80"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done || active
                          ? "bg-brand-400 text-zinc-950"
                          : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {done ? "✓" : s.id + 1}
                    </span>
                    <span>
                      <span className="block text-base font-medium text-slate-100">
                        {s.label}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {s.detail}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={replay}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-brand-400/50 hover:bg-brand-500/10"
          >
            <RotateCcw className="h-4 w-4" />
            Replay build
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a1220] shadow-elevated">
            <div className="flex items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-md bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-400 sm:text-xs">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    showLive ? "bg-emerald-400" : "animate-pulse bg-brand-400"
                  }`}
                />
                <span className="truncate">
                  {showLive
                    ? "smithplumbing.sitesinc.co"
                    : step === 0
                      ? "scaffolding…"
                      : "building preview…"}
                </span>
              </div>
            </div>

            <div className="relative min-h-[340px] p-4 sm:min-h-[380px] sm:p-5">
              <div
                className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.18),_transparent_55%)] transition-opacity duration-700 ${
                  step >= 1 ? "opacity-100" : "opacity-30"
                }`}
              />

              {step === 0 ? (
                <div className="relative flex h-[300px] flex-col justify-center gap-3 sm:h-[340px]">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-8 animate-pulse rounded-lg bg-white/10"
                      style={{
                        width: `${50 + n * 10}%`,
                        animationDelay: `${n * 80}ms`,
                      }}
                    />
                  ))}
                  <p className="mt-4 font-mono text-xs text-sky-300/80">
                    npx create-next-app → theme arctic → content.json
                  </p>
                </div>
              ) : (
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white sm:text-base">
                        {typed || DEMO.business}
                        {step === 1 &&
                        playing &&
                        typed.length < DEMO.business.length ? (
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-300 align-middle" />
                        ) : null}
                      </p>
                      {showHero ? (
                        <p className="text-xs text-sky-300/90">
                          {DEMO.keyword}
                        </p>
                      ) : null}
                    </div>
                    {showMoney ? (
                      <span className="shrink-0 rounded-lg bg-sky-400 px-2.5 py-1.5 text-xs font-semibold text-slate-950 sm:text-xs">
                        {DEMO.phone}
                      </span>
                    ) : null}
                  </div>

                  {showHero ? (
                    <div className="space-y-2">
                      <p className="text-lg font-semibold leading-snug tracking-tight text-white sm:text-xl">
                        The {DEMO.keyword.toLowerCase()} who shows up when it
                        matters.
                      </p>
                      <p className="max-w-md text-base text-slate-400">
                        {DEMO.tagline}
                      </p>
                      <button
                        type="button"
                        className="rounded-full bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_24px_-4px_rgba(56,189,248,0.55)]"
                      >
                        {DEMO.cta}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Loading hero, services, and CTAs…
                    </p>
                  )}

                  {showServices ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {DEMO.services.map((service) => (
                        <div
                          key={service}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200"
                        >
                          {service}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {showMoney ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                      <blockquote className="flex-1 rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-300">
                        “{DEMO.quote}”
                        <footer className="mt-1.5 text-sky-300/90">
                          — {DEMO.quoteName}
                        </footer>
                      </blockquote>
                      <div className="flex flex-col justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2.5 text-sm text-sky-100 sm:w-40">
                        <span className="font-semibold text-sky-200">
                          Money-ready
                        </span>
                        <span>Lead form · Stripe slot</span>
                        <span>Tap-to-call CTA</span>
                      </div>
                    </div>
                  ) : null}

                  {showLive ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                        Live on Netlify
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                        On-page SEO set
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                        Full code owned
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Sample client build (demo data). Paying customers get their own niche,
            copy, and design theme — same pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
