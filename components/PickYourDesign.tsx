"use client";

import { useState } from "react";
import MiniSiteFrame from "@/components/MiniSiteFrame";
import {
  DESIGN_STYLES,
  buildPreviewContent,
} from "@/lib/design-styles";

export default function PickYourDesign() {
  const [businessName, setBusinessName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const active = DESIGN_STYLES[activeIndex] ?? DESIGN_STYLES[0];
  const content = buildPreviewContent(businessName, keyword);

  return (
    <section
      id="pick-design"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-16 h-64 w-64 rounded-full bg-brand-800/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Pick your design
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            Bring your business name to life
          </h2>
          <p className="text-base text-slate-300">
            Type your name and service — the live preview fills in headlines,
            priced services, testimonials, and CTAs across all 8 layouts.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Business Name
            </span>
            <input
              type="text"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="e.g. Harbor Barbers"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-brand-400/60"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Keyword / Service
            </span>
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="e.g. fades & beard trims"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-brand-400/60"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {DESIGN_STYLES.map((design, index) => {
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-slate-300">
              Live preview · {active.name}
            </div>
          </div>

          <div
            key={`${active.id}-${content.business}-${content.tagline}`}
            className="animate-design-fade-in rounded-[26px] border border-white/5 bg-black/40 p-4 sm:p-5"
          >
            <MiniSiteFrame style={active} content={content} />
          </div>
        </div>
      </div>
    </section>
  );
}
