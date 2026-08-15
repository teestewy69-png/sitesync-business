"use client";

import { useState } from "react";
import content from "@/content.json";
import { scrollToId } from "@/lib/scroll";

export default function Hero() {
  const { hero, site, pricing } = content;
  const [spotsLeft] = useState(hero.offer.totalSpots);
  const launchCheckout = pricing.build.cta.href;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-black via-canvas to-black text-white">
      <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-800/25 blur-3xl" />

      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a href="#" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={`${site.name} logo`}
            className="h-20 w-auto rounded-lg ring-1 ring-white/10 sm:h-24"
          />
        </a>
        <a
          href={launchCheckout}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          Secure your spot
        </a>
      </nav>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 md:flex-row md:items-center md:py-24">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-200 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {hero.overline}
          </div>

          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {hero.headline}
          </h1>

          <p className="text-balance text-sm text-slate-300 sm:text-base">
            {hero.subheadline}
          </p>

          <div className="inline-flex items-center gap-3 rounded-xl border border-brand-400/30 bg-brand-500/10 px-4 py-2 text-xs sm:text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-400/20 text-brand-300">
              50%
            </div>
            <div>
              <p className="font-medium text-brand-200">{hero.offer.title}</p>
              <p className="text-[11px] text-brand-100/80 sm:text-xs">
                {hero.offer.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
            <a
              href={launchCheckout}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-brand-500/30 transition hover:from-brand-200 hover:to-brand-500"
            >
              {hero.primaryCta.label}
              <span className="ml-2 text-base transition group-hover:translate-x-0.5">
                →
              </span>
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-brand-400/60 hover:bg-brand-400/5"
              onClick={() => scrollToId(hero.secondaryCta.target)}
            >
              {hero.secondaryCta.label}
            </button>
          </div>

          <div className="space-y-1 text-xs text-slate-300 sm:text-sm">
            <p>{hero.pricingLine}</p>
            <p className="text-slate-400">{hero.stackLine}</p>
            <p className="text-[11px] text-emerald-300/90 sm:text-xs">
              Spots left at 50% off:{" "}
              <span className="font-semibold">{spotsLeft}</span> /{" "}
              {hero.offer.totalSpots}
            </p>
          </div>

          <p className="pt-1 text-[11px] text-slate-400 sm:text-xs">
            {hero.trustLine}
          </p>
        </div>

        <div className="flex-1">
          <div className="relative mx-auto max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-surface-elevated/80 via-surface/90 to-black/90 p-5 shadow-elevated backdrop-blur">
            <div className="mb-4 flex items-center justify-between text-xs text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Sample layout
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider">
                Ultra Modern Dark
              </span>
            </div>
            <div className="space-y-4">
              <div className="h-8 w-2/3 rounded-lg bg-gradient-to-r from-brand-300 to-brand-600" />
              <div className="space-y-2">
                <div className="h-2.5 w-5/6 rounded-full bg-white/10" />
                <div className="h-2.5 w-3/4 rounded-full bg-white/5" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="h-20 rounded-2xl bg-surface/80" />
                <div className="h-20 rounded-2xl bg-surface/60" />
                <div className="h-20 rounded-2xl bg-surface/40" />
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="space-y-1 text-[11px] text-slate-300">
                  <p className="font-medium text-slate-100">8 design styles</p>
                  <p className="text-slate-400">
                    Distinct layouts with their own structure and personality.
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-[11px] font-medium text-slate-50 transition hover:bg-brand-500 hover:text-zinc-950"
                  onClick={() => scrollToId("designs")}
                >
                  See 8 designs
                </button>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5" />
          </div>
        </div>
      </div>
    </section>
  );
}
