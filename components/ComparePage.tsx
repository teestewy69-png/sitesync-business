import Link from "next/link";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import content from "@/content.json";
import { COMPARE, COMPARE_CHECKED, COMPARE_CHECKED_ISO, type CompareEntry } from "@/lib/compare";
import { PATH_A_OFFER } from "@/lib/offer-copy";

export default function ComparePage({ entry }: { entry: CompareEntry }) {
  const origin = content.seo.url;
  const others = COMPARE.filter((c) => c.slug !== entry.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${origin}/compare/${entry.slug}#webpage`,
    url: `${origin}/compare/${entry.slug}`,
    name: entry.title,
    description: entry.description,
    dateModified: COMPARE_CHECKED_ISO,
    isPartOf: { "@id": `${origin}/#website` },
    publisher: { "@id": `${origin}/#organization` },
  };

  return (
    <SitePage>
      <OrgJsonLd />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Compare</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{entry.heading}</h1>
        <p className="mt-3 text-base text-slate-300">
          We build real, working websites, not subscriptions like the rest. For $1,995 flat, one time. {entry.intro}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Facts below were checked on {COMPARE_CHECKED}. Prices and terms change, so confirm with {entry.name} before you decide.
        </p>

        <h2 className="mt-12 text-2xl font-semibold">What {entry.name} publishes</h2>
        <ul className="mt-4 space-y-4">
          {entry.facts.map((f) => (
            <li key={f.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-semibold text-white">
                {f.label}
                {f.unverified ? <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300">Unverified</span> : null}
              </p>
              <p className="mt-1 text-sm text-slate-300">{f.value}</p>
              <p className="mt-2 text-xs text-slate-400">
                Source:{" "}
                <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-300 hover:underline">
                  {f.sourceLabel}
                </a>
                , checked {COMPARE_CHECKED}.
              </p>
            </li>
          ))}
        </ul>
        {entry.verifyNote ? <p className="mt-4 text-sm text-slate-400">{entry.verifyNote}</p> : null}

        <h2 className="mt-12 text-2xl font-semibold">How Sitesinc works</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-base text-slate-300">
          <li>Website build: $1,995 flat, one time. {`${PATH_A_OFFER.startDue}`} to start and {`${PATH_A_OFFER.launchDue}`} at launch.</li>
          <li>No long-term contract, and you own your website.</li>
          <li>
            Optional monitored SEO is separate and not part of the build: {PATH_A_OFFER.monitoring} (optional).
          </li>
          <li>Sitesinc is a small company. We build websites; we are not a software platform or an ad agency.</li>
        </ul>

        <h2 className="mt-12 text-2xl font-semibold">Questions to ask any provider, including us</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-base text-slate-300">
          {entry.askThem.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-6">
          <p className="text-xl font-semibold">Want a real, working website for $1,995?</p>
          <p className="mt-1 text-sm text-slate-300">
            Tell us about your business. Call {content.footer.phone} or email {content.footer.email}.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/contact#contact-form" className="inline-flex rounded-xl bg-brand-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-400">
              Request a website build
            </Link>
            <Link href="/free-website-audit" className="inline-flex rounded-xl border border-white/20 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/10">
              Free website audit
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-slate-400">
          Also compare:{" "}
          {others.map((o, i) => (
            <span key={o.slug}>
              {i > 0 ? " · " : ""}
              <Link href={`/compare/${o.slug}`} className="text-brand-300 hover:underline">
                {o.name} alternative
              </Link>
            </span>
          ))}
        </p>
        <p className="mt-4 text-xs text-slate-500">
          {entry.name} is a trademark of its owner. Sitesinc is not affiliated with {entry.name}. Information is taken from the sources linked above and may be out of date; see the source for current terms.
        </p>
      </article>
    </SitePage>
  );
}
