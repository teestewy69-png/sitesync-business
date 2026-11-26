/**
 * Free-audit banner strip (static — no animation).
 * This file was originally the pilot-pricing strip. Pilot pricing was
 * removed site-wide on 2026-11-23 by founder ruling ($1,995 flat is the
 * only price), and the founder ordered the strip kept with free-audit
 * wording instead. The file name stays because the push tooling cannot
 * delete or rename files; the component is FreeAuditBanner.
 *
 * 2026-11-25 declutter pass: slim single-row strip with one CTA, so it
 * reads as part of the page instead of a stacked banner block. Copy is
 * unchanged in substance: the audit offer and the free ebook stay.
 */
export default function FreeAuditBanner({ location = "home" }: { location?: string }) {
  return (
    <section className="border-t border-white/5 bg-black py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
            Free website audit
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight">
            Free audit of your website
          </p>
          <p className="mt-1 text-base text-slate-300">
            Give us your website address and email, and we&apos;ll run the audit and email you the results — with a free ebook included.
          </p>
        </div>
        <a
          href="/free-website-audit"
          data-analytics-cta="free_audit"
          data-analytics-location={`audit_${location}`}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:from-brand-200 hover:to-brand-500"
        >
          Run my free audit
        </a>
      </div>
    </section>
  );
}
