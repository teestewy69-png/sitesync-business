"use client";

import { useEffect, useMemo, useState } from "react";
import { designs } from "@/data/designs";

const ROTATION_INTERVAL = 8000;

export default function DesignChooser() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDesign = designs[activeIndex] ?? designs[0];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % designs.length);
    }, ROTATION_INTERVAL);
    return () => window.clearInterval(interval);
  }, []);

  const progressWidth = useMemo(
    () => `${((activeIndex + 1) / designs.length) * 100}%`,
    [activeIndex]
  );

  return (
    <section
      id="designs"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />
      <div className="pointer-events-none absolute top-20 right-0 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-0 h-64 w-64 rounded-full bg-brand-800/15 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 lg:flex-row lg:gap-12">
        <div className="space-y-6 lg:w-[38%]">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wider text-slate-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              8 rotating premium layouts
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              Choose a design that actually feels different.
            </h2>
            <p className="text-sm text-slate-300 sm:text-base">
              We don&apos;t just swap colors on the same template. Each layout
              has a different visual structure, content flow, and conversion
              feel—so you can pick the style that fits your brand best.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-300">
              <span>Now showing</span>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-brand-300">
                {activeDesign.label}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-lg font-semibold text-slate-50">
                {activeDesign.name}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {activeDesign.description}
              </p>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: progressWidth,
                  background: `linear-gradient(90deg, ${activeDesign.accentColor}, rgba(255,255,255,0.7))`,
                }}
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Auto-rotates every 8 seconds. Click any design below to preview it
              instantly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {designs.map((design, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={design.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`group rounded-2xl border p-3 text-left transition ${
                    isActive
                      ? "border-brand-400/70 bg-brand-500/10 shadow-glow"
                      : "border-white/10 bg-white/5 hover:border-brand-400/40 hover:bg-brand-400/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">
                      {design.label}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: design.accentColor }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-100">
                    {design.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
                    {design.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:w-[62%]">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-surface-elevated/95 via-black to-surface/90 p-4 shadow-elevated backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-300">
                Full layout preview
              </div>
            </div>

            <div className="relative min-h-[540px] overflow-hidden rounded-[24px] border border-white/5 bg-black/40 p-4 sm:p-5">
              <div key={activeDesign.id} className="animate-design-fade-in">
                <PreviewFrame
                  designId={activeDesign.id}
                  accentColor={activeDesign.accentColor}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.02] to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-[24px] border border-white/5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewFrame({
  designId,
  accentColor,
}: {
  designId: string;
  accentColor: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="h-7 w-7 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, rgba(255,255,255,0.85))`,
            }}
          />
          <div className="h-2.5 w-24 rounded-full bg-white/10" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <div className="h-2.5 w-10 rounded-full bg-white/5" />
          <div className="h-2.5 w-10 rounded-full bg-white/5" />
          <div className="h-2.5 w-10 rounded-full bg-white/5" />
        </div>
      </div>

      {designId === "neon-glass" && <NeonGlass accentColor={accentColor} />}
      {designId === "purple-gradient" && (
        <PurpleGradient accentColor={accentColor} />
      )}
      {designId === "minimal-dark" && <MinimalDark accentColor={accentColor} />}
      {designId === "split-hero" && <SplitHero accentColor={accentColor} />}
      {designId === "card-grid" && <CardGrid accentColor={accentColor} />}
      {designId === "bold-type" && <BoldType accentColor={accentColor} />}
      {designId === "photo-focus" && <PhotoFocus accentColor={accentColor} />}
      {designId === "funnel-ready" && <FunnelReady accentColor={accentColor} />}

      <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-2.5 w-28 rounded-full bg-white/10" />
            <div className="h-2 w-40 rounded-full bg-white/5" />
          </div>
          <div
            className="h-9 w-32 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>
    </div>
  );
}

function NeonGlass({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        <div
          className="mb-4 h-10 w-3/4 rounded-2xl"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, rgba(255,255,255,0.9))`,
            boxShadow: `0 0 40px ${accentColor}55`,
          }}
        />
        <div className="space-y-2">
          <div className="h-3 w-5/6 rounded-full bg-white/10" />
          <div className="h-3 w-2/3 rounded-full bg-white/5" />
        </div>
        <div className="mt-5 flex gap-3">
          <div
            className="h-10 w-32 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <div className="h-10 w-28 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard />
        <GlassCard />
        <GlassCard />
      </div>
    </>
  );
}

function PurpleGradient({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
          <div className="h-3 w-3/4 rounded-full bg-white/10" />
          <div className="mt-3 h-3 w-1/2 rounded-full bg-white/5" />
          <div className="mt-5 flex gap-3">
            <div
              className="h-10 w-32 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accentColor}, rgba(255,255,255,0.6))`,
              }}
            />
            <div className="h-10 w-24 rounded-full bg-white/10" />
          </div>
        </div>
        <div
          className="rounded-[26px] p-6"
          style={{
            background: `linear-gradient(135deg, ${accentColor}88, rgba(255,255,255,0.08), rgba(0,0,0,0.25))`,
          }}
        >
          <div className="h-full min-h-[140px] rounded-2xl bg-black/20" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionBlock />
        <SectionBlock />
      </div>
    </>
  );
}

function MinimalDark({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-black/20 p-6">
        <div className="space-y-3">
          <div className="h-3 w-2/3 rounded-full bg-white/10" />
          <div className="h-2.5 w-1/2 rounded-full bg-white/5" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <MinimalCard accentColor={accentColor} />
          <MinimalCard accentColor={accentColor} />
          <MinimalCard accentColor={accentColor} />
        </div>
      </div>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.02] p-5">
        <div className="h-2.5 w-24 rounded-full bg-white/10" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="h-16 rounded-2xl bg-white/[0.03]" />
          <div className="h-16 rounded-2xl bg-white/[0.03]" />
        </div>
      </div>
    </>
  );
}

function SplitHero({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[26px] bg-surface/90 p-3">
          <div className="h-full min-h-[180px] rounded-[20px] bg-white/[0.05]" />
        </div>
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <div className="h-3 w-3/4 rounded-full bg-white/10" />
          <div className="mt-3 h-2.5 w-2/3 rounded-full bg-white/5" />
          <div className="mt-6">
            <div
              className="h-10 w-32 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionBlock />
        <SectionBlock />
      </div>
    </>
  );
}

function CardGrid({ accentColor }: { accentColor: string }) {
  return (
    <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
      <div className="h-3 w-1/3 rounded-full bg-white/10" />
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <GridCard accentColor={accentColor} />
        <GridCard accentColor={accentColor} />
        <GridCard accentColor={accentColor} />
        <GridCard accentColor={accentColor} />
        <GridCard accentColor={accentColor} />
        <GridCard accentColor={accentColor} />
      </div>
    </div>
  );
}

function BoldType({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.02] p-6">
        <div className="space-y-3">
          <div className="h-5 w-5/6 rounded-full bg-white/10" />
          <div className="h-4 w-2/3 rounded-full bg-white/5" />
        </div>
        <div className="mt-5 flex gap-3">
          <div
            className="h-11 w-36 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <div className="h-11 w-28 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-[26px] bg-surface/80" />
        <div className="h-32 rounded-[26px] bg-surface/70" />
      </div>
    </>
  );
}

function PhotoFocus({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="rounded-[26px] bg-surface/90 p-3">
        <div className="h-[220px] rounded-[20px] bg-white/[0.06]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
          <div className="h-3 w-2/3 rounded-full bg-white/10" />
          <div className="mt-3 h-2.5 w-1/2 rounded-full bg-white/5" />
        </div>
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
          <div
            className="h-10 w-28 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>
    </>
  );
}

function FunnelReady({ accentColor }: { accentColor: string }) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
        <div className="space-y-3">
          <div className="h-3 w-1/2 rounded-full bg-white/10" />
          <div className="h-2.5 w-2/3 rounded-full bg-white/5" />
        </div>
        <div className="mt-5 flex gap-3">
          <div
            className="h-10 w-28 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <div className="h-10 w-24 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FunnelStep accentColor={accentColor} />
        <FunnelStep accentColor={accentColor} />
        <FunnelStep accentColor={accentColor} />
      </div>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
        <div className="h-3 w-1/4 rounded-full bg-white/10" />
        <div className="mt-4 h-20 rounded-2xl bg-surface/80" />
      </div>
    </>
  );
}

function GlassCard() {
  return (
    <div className="h-24 rounded-[22px] border border-white/10 bg-white/[0.04] backdrop-blur" />
  );
}

function SectionBlock() {
  return (
    <div className="h-24 rounded-[24px] border border-white/5 bg-white/[0.03]" />
  );
}

function MinimalCard({ accentColor }: { accentColor: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div
        className="h-1.5 w-10 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
    </div>
  );
}

function GridCard({ accentColor }: { accentColor: string }) {
  return (
    <div className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4">
      <div
        className="h-2 w-10 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
    </div>
  );
}

function FunnelStep({ accentColor }: { accentColor: string }) {
  return (
    <div className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-zinc-950"
        style={{ backgroundColor: accentColor }}
      >
        →
      </div>
      <div className="mt-3 h-2 w-3/4 rounded-full bg-white/10" />
      <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
    </div>
  );
}
