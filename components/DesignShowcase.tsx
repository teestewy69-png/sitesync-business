"use client";

import { useEffect, useState } from "react";

type ShowcaseDesign = {
  id: string;
  name: string;
  accent: string;
  business: string;
  service: string;
  cta: string;
};

const showcaseDesigns: ShowcaseDesign[] = [
  {
    id: "neon-glass",
    name: "Neon Glass",
    accent: "#22d3ee",
    business: "Nova Auto Detailing",
    service: "Premium mobile detailing that makes your ride look brand new.",
    cta: "Book My Detail",
  },
  {
    id: "purple-gradient",
    name: "Purple Gradient",
    accent: "#a855f7",
    business: "Luxe Skin Studio",
    service: "Beauty treatments, skincare, and confidence-boosting results.",
    cta: "Book a Session",
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    accent: "#f97316",
    business: "Blackstone Consulting",
    service: "Strategic financial guidance for modern entrepreneurs.",
    cta: "Request Consultation",
  },
  {
    id: "split-hero",
    name: "Split Hero",
    accent: "#22c55e",
    business: "Smith Plumbing & Heating",
    service: "Fast, reliable service when your home needs help now.",
    cta: "Request Service",
  },
  {
    id: "card-grid",
    name: "Card Grid",
    accent: "#eab308",
    business: "Iron Forge Fitness",
    service: "Home gym solutions built for strength, energy, and daily progress.",
    cta: "Explore Packages",
  },
  {
    id: "bold-type",
    name: "Bold Type",
    accent: "#3b82f6",
    business: "Apex Business Coaching",
    service: "Clarity, systems, and momentum for small business owners.",
    cta: "Get Started",
  },
  {
    id: "photo-focus",
    name: "Photo Focus",
    accent: "#ec4899",
    business: "Golden Hour Pet Grooming",
    service: "Gentle, at-home grooming your pets will actually enjoy.",
    cta: "Book Grooming",
  },
  {
    id: "funnel-ready",
    name: "Funnel Ready",
    accent: "#f43f5e",
    business: "Evergreen Wellness Co.",
    service: "Daily supplement support for energy, balance, and longevity.",
    cta: "Shop the Bundle",
  },
];

const ROTATE_MS = 8000;

export default function DesignShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % showcaseDesigns.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const active = showcaseDesigns[activeIndex] ?? showcaseDesigns[0];

  return (
    <section
      id="designs"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-20 h-72 w-72 rounded-full bg-brand-800/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Full Design Showcase
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            Watch all 8 layouts come to life.
          </h2>
          <p className="text-sm text-slate-300 sm:text-base">
            These aren&apos;t just color swaps. Each design has its own layout,
            personality, and conversion flow. Watch them rotate automatically to
            get a real feel for what your site could look like.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {showcaseDesigns.map((design, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={design.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  isActive
                    ? "border-brand-400/70 bg-brand-500/10 text-brand-200"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-brand-400/40 hover:bg-brand-400/5"
                }`}
              >
                {design.name}
              </button>
            );
          })}
        </div>

        <div className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-surface-elevated/95 via-black to-surface/90 p-4 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-300">
              Now Showing: {active.name}
            </div>
          </div>

          <div
            key={active.id}
            className="animate-design-fade-in rounded-[26px] border border-white/5 bg-black/40 p-4 sm:p-5"
          >
            <ShowcaseFrame design={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseFrame({ design }: { design: ShowcaseDesign }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${design.accent}, rgba(255,255,255,0.85))`,
            }}
          />
          <span className="text-sm font-semibold text-slate-100">
            {design.business}
          </span>
        </div>
        <div className="hidden gap-2 sm:flex">
          <div className="h-2.5 w-10 rounded-full bg-white/5" />
          <div className="h-2.5 w-10 rounded-full bg-white/5" />
          <div className="h-2.5 w-10 rounded-full bg-white/5" />
        </div>
      </div>

      {design.id === "neon-glass" && <NeonGlass design={design} />}
      {design.id === "purple-gradient" && <PurpleGradient design={design} />}
      {design.id === "minimal-dark" && <MinimalDark design={design} />}
      {design.id === "split-hero" && <SplitHero design={design} />}
      {design.id === "card-grid" && <CardGrid design={design} />}
      {design.id === "bold-type" && <BoldType design={design} />}
      {design.id === "photo-focus" && <PhotoFocus design={design} />}
      {design.id === "funnel-ready" && <FunnelReady design={design} />}

      <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-2.5 w-24 rounded-full bg-white/10" />
            <div className="h-2 w-36 rounded-full bg-white/5" />
          </div>
          <div
            className="h-10 w-32 rounded-full"
            style={{ backgroundColor: design.accent }}
          />
        </div>
      </div>
    </div>
  );
}

function NeonGlass({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur">
        <div
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{
            color: design.accent,
            textShadow: `0 0 20px ${design.accent}`,
          }}
        >
          {design.business}
        </div>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">{design.service}</p>
        <div className="mt-5 flex gap-3">
          <div
            className="rounded-full px-5 py-3 text-sm font-semibold text-black"
            style={{ backgroundColor: design.accent }}
          >
            {design.cta}
          </div>
          <div className="rounded-full bg-white/10 px-5 py-3 text-sm text-slate-100">
            Learn More
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel />
        <Panel />
        <Panel />
      </div>
    </>
  );
}

function PurpleGradient({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
          <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {design.business}
          </div>
          <p className="mt-3 text-sm text-slate-300">{design.service}</p>
          <div className="mt-5">
            <div
              className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(90deg, ${design.accent}, rgba(255,255,255,0.3))`,
              }}
            >
              {design.cta}
            </div>
          </div>
        </div>
        <div
          className="rounded-[26px] p-5"
          style={{
            background: `linear-gradient(135deg, ${design.accent}99, rgba(255,255,255,0.04), rgba(0,0,0,0.28))`,
          }}
        >
          <div className="h-full min-h-[180px] rounded-[20px] bg-black/20" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel />
        <Panel />
      </div>
    </>
  );
}

function MinimalDark({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-black/20 p-6">
        <div className="max-w-2xl">
          <div className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            {design.business}
          </div>
          <p className="mt-3 text-sm text-slate-300">{design.service}</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <MiniCard accent={design.accent} />
          <MiniCard accent={design.accent} />
          <MiniCard accent={design.accent} />
        </div>
      </div>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.02] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-2xl bg-white/[0.03]" />
          <div className="h-20 rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    </>
  );
}

function SplitHero({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[26px] bg-surface/90 p-3">
          <div className="h-full min-h-[210px] rounded-[20px] bg-white/[0.05]" />
        </div>
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {design.business}
          </div>
          <p className="mt-3 text-sm text-slate-300">{design.service}</p>
          <div className="mt-6">
            <div
              className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-black"
              style={{ backgroundColor: design.accent }}
            >
              {design.cta}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel />
        <Panel />
      </div>
    </>
  );
}

function CardGrid({ design }: { design: ShowcaseDesign }) {
  return (
    <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
      <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {design.business}
      </div>
      <p className="mt-3 text-sm text-slate-300">{design.service}</p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <GridItem accent={design.accent} />
        <GridItem accent={design.accent} />
        <GridItem accent={design.accent} />
        <GridItem accent={design.accent} />
        <GridItem accent={design.accent} />
        <GridItem accent={design.accent} />
      </div>
    </div>
  );
}

function BoldType({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.02] p-6">
        <div className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {design.business}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-slate-300">{design.service}</p>
        <div className="mt-5 flex gap-3">
          <div
            className="rounded-full px-6 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: design.accent }}
          >
            {design.cta}
          </div>
          <div className="rounded-full bg-white/10 px-6 py-3 text-sm text-slate-100">
            See Results
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-[26px] bg-surface/80" />
        <div className="h-28 rounded-[26px] bg-surface/70" />
      </div>
    </>
  );
}

function PhotoFocus({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="rounded-[26px] bg-surface/90 p-3">
        <div className="h-[240px] rounded-[20px] bg-white/[0.06]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {design.business}
          </div>
          <p className="mt-3 text-sm text-slate-300">{design.service}</p>
        </div>
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <div
            className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-black"
            style={{ backgroundColor: design.accent }}
          >
            {design.cta}
          </div>
        </div>
      </div>
    </>
  );
}

function FunnelReady({ design }: { design: ShowcaseDesign }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
        <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {design.business}
        </div>
        <p className="mt-3 text-sm text-slate-300">{design.service}</p>
        <div className="mt-5">
          <div
            className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: design.accent }}
          >
            {design.cta}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FunnelCard accent={design.accent} />
        <FunnelCard accent={design.accent} />
        <FunnelCard accent={design.accent} />
      </div>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
        <div className="h-24 rounded-2xl bg-surface/80" />
      </div>
    </>
  );
}

function Panel() {
  return (
    <div className="h-24 rounded-[24px] border border-white/5 bg-white/[0.03]" />
  );
}

function MiniCard({ accent }: { accent: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div
        className="h-1.5 w-10 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
    </div>
  );
}

function GridItem({ accent }: { accent: string }) {
  return (
    <div className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4">
      <div
        className="h-2 w-10 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
    </div>
  );
}

function FunnelCard({ accent }: { accent: string }) {
  return (
    <div className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-black"
        style={{ backgroundColor: accent }}
      >
        →
      </div>
      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
    </div>
  );
}
