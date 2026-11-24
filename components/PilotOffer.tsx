/**
 * Free-audit banner strip (static — no animation).
 * This file was originally the pilot-pricing strip. Pilot pricing was
 * removed site-wide on 2026-11-23 by founder ruling ($1,995 flat is the
 * only price), and the founder ordered the strip kept with free-audit
 * wording instead. The file name stays because the push tooling cannot
 * delete or rename files; the component is FreeAuditBanner.
 */
export default function FreeAuditBanner({ location = "home" }: { location?: string }) {
  return (
    <section className="border-t border-white/5 bg-gradient-to-r from-brand-900/40 via-black to-brand-900/40 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Free website audit</p>
          <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Free audit of your website
          </p>
          <p className="mt-2 text-base text-slate-300">
            Give us your website address and email, and we&apos;ll run the audit and email you the results — with a free ebook included.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="/free-website-audit"
            data-analytics-cta="free_audit"
            data-analytics-location={`audit_${location}`}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-brand-500/30"
          >
            Run my free audit
          </a>
          <a
            href="/contact"
            data-analytics-cta="contact"
            data-analytics-location={`audit_${location}`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 hover:border-brand-400/60"
          >
            Contact us
          </a>
        </div>
      </div>
    </section>
  );
}
