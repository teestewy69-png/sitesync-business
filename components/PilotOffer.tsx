import { SERVICE_AREA, SITESINC_PHONE, SITESINC_PHONE_HREF } from "@/data/trades";

/** Pilot pricing strip: facts only ($1,495 for the first 3 clients). */
export default function PilotOffer({ location = "home" }: { location?: string }) {
  return (
    <section className="border-t border-white/5 bg-gradient-to-r from-brand-900/40 via-black to-brand-900/40 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Pilot pricing</p>
          <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            $1,495 instead of $1,995 for our first 3 clients.
          </p>
          <p className="mt-2 text-base text-slate-300">
            For local businesses in {SERVICE_AREA}. Same build, same 50/50 split. Ask if a spot is still open.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={SITESINC_PHONE_HREF}
            data-analytics-cta="call"
            data-analytics-location={`pilot_${location}`}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-brand-500/30"
          >
            Call {SITESINC_PHONE}
          </a>
          <a
            href="/contact"
            data-analytics-cta="ask_pilot"
            data-analytics-location={`pilot_${location}`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 hover:border-brand-400/60"
          >
            Ask about a pilot spot
          </a>
        </div>
      </div>
    </section>
  );
}
