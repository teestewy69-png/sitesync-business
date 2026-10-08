export default function ContentEngine() {
  return (
    <section className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-5xl space-y-6 px-6">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Not just a pretty site. A content &amp; SEO engine underneath.
          </h2>
          <p className="text-base text-slate-300 sm:text-base">
            Before working with you, we built an internal system that studies
            the top sites in a niche, maps their keywords, headings, and content
            gaps, then helps us create more complete, more authoritative
            articles. We now use that mindset and tooling to give your site a
            real SEO foundation—not just generic &ldquo;lorem ipsum&rdquo;
            pages.
          </p>
        </div>

        <div className="grid gap-4 text-base text-slate-300 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              Competitive research
            </p>
            <p className="mt-1 text-base">
              We look at top websites in your niche to understand what
              they&apos;re ranking for, how they structure content, and where
              they&apos;re weak.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              Gap-focused content
            </p>
            <p className="mt-1 text-base">
              Instead of copying, we fill the gaps—creating more helpful, more
              complete pages that give your visitors what competitors miss.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              Structured for growth
            </p>
            <p className="mt-1 text-base">
              Articles, internal links, and on-page SEO are planned together, so
              your website isn&apos;t just launched—it&apos;s positioned to
              grow.
            </p>
          </div>
        </div>

        <p className="text-base text-slate-400">
          You don&apos;t have to manage any of this. We use our internal tools
          and process to make sure your site launches with a clear SEO plan
          instead of a blank blog.
        </p>
      </div>
    </section>
  );
}
