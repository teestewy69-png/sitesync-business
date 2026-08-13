import { Check, ClipboardList } from "lucide-react";
import content from "@/content.json";

export default function Pricing() {
  const { pricing, onboarding } = content;

  return (
    <section
      id="pricing"
      className="border-y border-white/5 bg-surface-muted/60"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {pricing.title}
          </h2>
          <p className="mt-4 text-slate-400">{pricing.subtitle}</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-8 lg:grid-cols-5">
          {/* Main build offer */}
          <div className="relative overflow-hidden rounded-3xl bg-surface p-8 shadow-elevated ring-2 ring-brand-500/60 lg:col-span-3">
            <span className="absolute right-0 top-0 rounded-bl-2xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-1.5 text-xs font-semibold text-zinc-950">
              {pricing.build.launchNote}
            </span>
            <h3 className="text-lg font-semibold text-white">
              {pricing.build.name}
            </h3>
            <p className="mt-6 flex items-baseline gap-3">
              <span className="text-2xl text-slate-500 line-through">
                {pricing.build.regularPrice}
              </span>
              <span className="text-5xl font-bold tracking-tight text-white">
                {pricing.build.launchPrice}
              </span>
              <span className="text-slate-400">one-time</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              {pricing.build.detail}
            </p>
            <a
              href={pricing.build.cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3.5 font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 sm:w-auto"
            >
              {pricing.build.cta.label}
            </a>
            {pricing.build.fullPriceCta?.href && (
              <a
                href={pricing.build.fullPriceCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-slate-400 transition hover:text-brand-300"
              >
                {pricing.build.fullPriceCta.label} →
              </a>
            )}
          </div>

          {/* Optional maintenance */}
          <div className="rounded-3xl bg-surface p-8 shadow-card ring-1 ring-white/10 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white">
              {pricing.maintenance.name}
            </h3>
            <p className="mt-6">
              <span className="text-4xl font-bold tracking-tight text-white">
                {pricing.maintenance.price}
              </span>
            </p>
            <p className="mt-4 text-sm text-slate-400">
              {pricing.maintenance.detail}
            </p>
            <ul className="mt-6 space-y-3">
              {pricing.maintenance.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  <span className="text-sm text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
            {pricing.maintenance.cta?.href && (
              <a
                href={pricing.maintenance.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-white/5 px-6 py-3 font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
              >
                {pricing.maintenance.cta.label}
              </a>
            )}
          </div>
        </div>

        {/* Onboarding checklist */}
        <div className="mx-auto mt-14 max-w-4xl rounded-3xl bg-surface p-8 shadow-card ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/25">
              <ClipboardList className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold text-white">
              {onboarding.title}
            </h3>
          </div>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {onboarding.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <span className="text-sm text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-500">{onboarding.note}</p>
        </div>
      </div>
    </section>
  );
}
