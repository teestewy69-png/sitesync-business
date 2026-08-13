"use client";

import { useState } from "react";
import { designs } from "@/data/designs";

export default function DesignChooser() {
  const [businessName, setBusinessName] = useState("Your Business Name");
  const [keyword, setKeyword] = useState("Your Main Service");
  const [activeDesignId, setActiveDesignId] = useState(designs[0]?.id ?? "");
  const activeDesign =
    designs.find((d) => d.id === activeDesignId) ?? designs[0];

  return (
    <section
      id="designs"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 md:flex-row md:gap-12">
        <div className="space-y-6 md:w-[42%]">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Choose your look.
              <span className="block text-lg font-normal text-slate-300 sm:text-xl">
                Try your business name across 8 ultra-modern designs.
              </span>
            </h2>
            <p className="text-sm text-slate-300">
              Type in your business name and main service. Click through the
              designs to see how your brand could show up with a dark, glossy,
              high-converting layout built on Next.js &amp; Tailwind.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-200">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) =>
                  setBusinessName(e.target.value || "Your Business Name")
                }
                placeholder="e.g. Smith Plumbing & Heating"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-400/70 focus:ring-2 focus:ring-brand-400/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-200">
                Main Keyword / Service
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) =>
                  setKeyword(e.target.value || "Your Main Service")
                }
                placeholder="e.g. Emergency Plumber, Lash Tech, Mobile Detailer"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-400/70 focus:ring-2 focus:ring-brand-400/30"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              We&apos;ll use this info in your hero section, calls-to-action,
              and SEO basics when we build your real site.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Pick a design style
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {designs.map((design) => {
                const isActive = design.id === activeDesign.id;
                return (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => setActiveDesignId(design.id)}
                    className={`group flex flex-col rounded-xl border px-3 py-2 text-left text-xs transition ${
                      isActive
                        ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                        : "border-white/10 bg-white/5 hover:border-brand-400/50 hover:bg-brand-400/5"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400">
                        {design.label}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: design.accentColor }}
                      />
                    </span>
                    <span className="mt-1.5 text-[11px] font-semibold text-slate-50">
                      {design.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">
                      {design.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="md:w-[58%]">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-surface-elevated/90 via-black/95 to-surface/80 p-5 shadow-elevated backdrop-blur">
            <div className="mb-4 flex items-center justify-between text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-10 rounded-full bg-white/10" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-slate-400">Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-slate-500 sm:inline">Design:</span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-200">
                  {activeDesign.name}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-200">
                  {keyword || "Your Main Service"}
                </p>
                <h3 className="text-lg font-semibold text-slate-50 sm:text-xl">
                  {businessName || "Your Business Name"}
                </h3>
                <p className="text-xs text-slate-300 sm:text-sm">
                  A high-converting, ultra-modern site built for{" "}
                  {keyword || "your service"} — SEO-ready, Stripe-ready, and
                  owned by you.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-950 shadow-lg transition"
                  style={{ background: activeDesign.accentColor }}
                >
                  Book More {keyword || "Customers"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-slate-100"
                >
                  View Services
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="space-y-2 rounded-2xl bg-surface/90 p-3">
                  <div
                    className="h-1.5 w-10 rounded-full"
                    style={{ backgroundColor: activeDesign.accentColor }}
                  />
                  <div className="h-2 w-3/4 rounded-full bg-white/10" />
                  <div className="h-2 w-1/2 rounded-full bg-white/5" />
                </div>
                <div className="space-y-2 rounded-2xl bg-surface/80 p-3">
                  <div className="h-1.5 w-10 rounded-full bg-white/10" />
                  <div className="h-2 w-2/3 rounded-full bg-white/10" />
                  <div className="h-2 w-1/2 rounded-full bg-white/5" />
                </div>
                <div className="space-y-2 rounded-2xl bg-surface/60 p-3">
                  <div className="h-1.5 w-10 rounded-full bg-white/10" />
                  <div className="h-2 w-2/3 rounded-full bg-white/10" />
                  <div className="h-2 w-1/2 rounded-full bg-white/5" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-[11px] text-slate-400">
                <p>
                  Final builds include SEO, funnels, monetization &amp; your
                  real content.
                </p>
                <span className="hidden rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300 sm:inline">
                  Demo Preview
                </span>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/5" />
          </div>
        </div>
      </div>
    </section>
  );
}
