const before = [
  "No page title (browser tab says “Untitled”)",
  "No meta description for search results",
  "Large images, slow to load",
  "Not mobile-friendly: tiny text, sideways scrolling",
  "No schema, so search engines guess what the business is",
  "Phone number buried in an image",
];
const after = [
  "Clear page title with business name and city",
  "Written meta description for search results",
  "Compressed images, fast static pages",
  "Mobile-first layout with a tap-to-call button",
  "LocalBusiness schema: name, phone, hours, service area",
  "Phone and contact form on every page",
];

export default function BeforeAfterSeo() {
  return (
    <section id="before-after" className="border-t border-white/5 bg-black py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Illustrative example</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sitesinc Before SEO vs. Sitesinc After SEO</h2>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          An example of what our free diagnostic looks for, and what we fix. This is a sample illustration, not a real client and not a ranking promise.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-red-500/30 bg-zinc-950 p-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-red-300">Sitesinc Before SEO</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-800 p-3 font-mono text-xs text-slate-400">
              &lt;title&gt;&lt;/title&gt;<br />&lt;!-- no meta description --&gt;<br />&lt;!-- no schema --&gt;
            </div>
            <div className="mt-4 h-28 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 p-3 text-[10px] text-zinc-400">
              <div className="h-3 w-4/5 rounded bg-zinc-600" />
              <div className="mt-2 h-12 w-[130%] rounded bg-zinc-600/60" />
              <p className="mt-2">Loading…</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {before.map((b) => (<li key={b} className="flex gap-2"><span className="text-red-400">✕</span>{b}</li>))}
            </ul>
          </div>
          <div className="rounded-3xl border border-brand-400/50 bg-gradient-to-br from-zinc-950 to-black p-5 shadow-lg shadow-brand-500/10">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">Sitesinc After SEO</p>
            <div className="mt-4 rounded-xl border border-brand-400/20 bg-black p-3 font-mono text-xs text-brand-100/80">
              &lt;title&gt;Joe&apos;s Plumbing | Walnut, CA&lt;/title&gt;<br />&lt;meta name=&quot;description&quot; …&gt;<br />&lt;script type=&quot;application/ld+json&quot;&gt; LocalBusiness
            </div>
            <div className="mt-4 h-28 rounded-xl border border-brand-400/20 bg-black p-3">
              <div className="h-3 w-1/2 rounded bg-brand-400" />
              <div className="mt-2 h-2 w-3/4 rounded bg-white/30" />
              <div className="mt-4 inline-block rounded-full bg-brand-400 px-3 py-1 text-[10px] font-semibold text-black">Tap to call</div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {after.map((a) => (<li key={a} className="flex gap-2"><span className="text-brand-300">✓</span>{a}</li>))}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="/free-website-audit" data-analytics-cta="free_diagnostic" data-analytics-location="before_after"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950">
            Get Your Free Website Diagnostic →
          </a>
          <p className="text-sm text-slate-400">
            Or call <a href="tel:+19093231575" className="text-brand-300">(909) 323-1575</a> · <a href="mailto:save@sitesinc.co" className="text-brand-300">save@sitesinc.co</a>
          </p>
        </div>
      </div>
    </section>
  );
}
