import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import AuditCaptureForm from "@/components/AuditCaptureForm";
import content from "@/content.json";
import { OG_IMAGE } from "@/lib/og-image";
import { LOCATIONS_ORIGIN } from "@/lib/locations";
import { COMPARE } from "@/lib/compare";

const title = "Free Website Audit for Small Businesses | Sitesinc";
const description =
  "Free website audit for small businesses: give us your website address and email, and we crawl up to 10 pages, score your site 0-100, and email you the results — broken links, missing descriptions, contact details that disagree — with a free copy of our ebook.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/free-website-audit` },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: `${LOCATIONS_ORIGIN}/free-website-audit`, images: [OG_IMAGE] },
};

const GETS = [
  "Your audit results, emailed to you — what we checked, what we found, and your site's score out of 100",
  "A free copy of our ebook, What Your Web Builder Won't Tell You",
  "No obligation — the results and the ebook are yours to keep, and the next step is yours",
];

const CHECKS = [
  ["Secure connection (HTTPS)", "Does the site load over HTTPS? Browsers warn visitors on sites that don't."],
  ["Mobile-ready setup", "Does the site declare a mobile viewport so phones don't show a shrunken desktop page?"],
  ["Page titles and search descriptions", "Does every page have a title and a meta description at a sensible length for Google results?"],
  ["Broken links and unreachable pages", "Do internal links lead somewhere real, and can search engines reach every page?"],
  ["Contact details that agree", "Do the phone numbers and addresses match across pages — or do different pages tell visitors different things?"],
  ["Tap-to-call and contact paths", "Can a phone visitor call you in one tap, and is there a working contact path?"],
  ["Link to your Google Business Profile", "Does the site link to your Google Maps or Business Profile listing?"],
  ["A score for the whole site", "We crawl up to 10 pages and score the site 0-100, with the findings ranked high, medium and low."],
];

const FAQ = [
  ["What does the audit actually do?", "We crawl up to 10 pages of your site and score what we find — broken links, missing titles and descriptions, contact details that disagree between pages, pages search engines can't reach, and more — then email you the results with your score."],
  ["What does it not do?", "It is not a full SEO, design or traffic review. It does not measure Google's Core Web Vitals, rankings or traffic. For a deeper speed test, use Google PageSpeed Insights."],
  ["Why do you need my email?", "Because the results come back to you by email, along with your free ebook. We save your website address and email with your audit so we can send it. If you'd rather not hear from us again, reply to the email and say so."],
  ["Does it work on every site?", "No. Some sites block automated visitors or load most of their content with JavaScript, so the results can miss things. If we can't get in, we'll email you — and if you ask, we'll check your site by hand."],
];

export default function FreeWebsiteAudit() {
  const origin = content.seo.url;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${origin}/free-website-audit#webpage`,
        url: `${origin}/free-website-audit`,
        name: title,
        description,
        isPartOf: { "@id": `${origin}/#website` },
        publisher: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };

  return (
    <SitePage>
      <OrgJsonLd />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Free tool</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Get a free audit of your website, sent to your inbox</h1>
        <p className="mt-3 text-base text-slate-300">
          Enter your website address and your email, and we&rsquo;ll run the audit and send the results to your inbox.
        </p>

        <h2 className="mt-10 text-xl font-semibold">What you get</h2>
        <ul className="mt-3 space-y-2">
          {GETS.map((item) => (
            <li key={item} className="flex gap-2 text-base text-slate-300">
              <span aria-hidden="true" className="text-emerald-300">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <AuditCaptureForm />
        </div>

        <h2 className="mt-14 text-2xl font-semibold">What we check</h2>
        <ul className="mt-4 space-y-3">
          {CHECKS.map(([label, text]) => (
            <li key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white">{label}</p>
              <p className="mt-1 text-sm text-slate-300">{text}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-2xl font-semibold">Questions</h2>
        <dl className="mt-4 space-y-5">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold text-white">{q}</dt>
              <dd className="mt-1 text-sm text-slate-300">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-14 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-6">
          <p className="text-xl font-semibold">Need a website, or a better one?</p>
          <p className="mt-1 text-sm text-slate-300">
            $1,995 flat, one time. {content.footer.phone} · {content.footer.email}
          </p>
          <Link href="/contact#contact-form" className="mt-4 inline-flex rounded-xl bg-brand-500 px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-400">
            Request a website build
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-400">
          Comparing providers?{" "}
          {COMPARE.map((c, i) => (
            <span key={c.slug}>
              {i > 0 ? " · " : ""}
              <Link href={`/compare/${c.slug}`} className="text-brand-300 hover:underline">
                {c.name} alternative
              </Link>
            </span>
          ))}
        </p>
      </section>
    </SitePage>
  );
}
