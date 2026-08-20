"use client";

import { useEffect, useState } from "react";
import MiniSiteFrame from "@/components/MiniSiteFrame";
import { DESIGN_STYLES, SITESYNC_SITE } from "@/lib/design-styles";

const ROTATE_MS = 8000;

export default function DesignShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % DESIGN_STYLES.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const active = DESIGN_STYLES[activeIndex] ?? DESIGN_STYLES[0];

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
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            8 designs
          </h2>
          <p className="text-sm text-slate-300 sm:text-base">
            Ultra-modern layouts with different structure and personality —
            watching Sitesync Business rotate through each one. This is the live
            sitesinc.co offer, not a fake demo client.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
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
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-300">
              Sitesync · {active.name}
            </div>
          </div>

          <div
            key={active.id}
            className="animate-design-fade-in rounded-[26px] border border-white/5 bg-black/40 p-4 sm:p-5"
          >
            <MiniSiteFrame style={active} content={SITESYNC_SITE} />
          </div>
        </div>
      </div>
    </section>
  );
}
