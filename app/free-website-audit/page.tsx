import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import AuditForm from "@/components/AuditForm";
import content from "@/content.json";
import { OG_IMAGE } from "@/lib/og-image";
import { LOCATIONS_ORIGIN } from "@/lib/locations";
import { COMPARE } from "@/lib/compare";

const title = "Free Website Audit for Small Businesses | Sitesinc";
const description =
  "Enter your website address and get seven plain checks: HTTPS, mobile setup, quick load check, page title, search description, contact info and your Google Business Profile link. Free, no email needed.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/free-website-audit` },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: `${LOCATIONS_ORIGIN}/free-website-audit`, images: [OG_IMAGE] },
};

const CHECKS = [
  ["Secure connection (HTTPS)", "Does the page load over HTTPS? Browsers warn visitors on sites that don't."],
  ["Mobile-ready setup", "Does the page declare a mobile viewport so phones don't show a shrunken desktop page?"],
  ["Page load (quick check)", "How long our server took to load the page, and how big the HTML is. This is a basic check, not a full speed test."],
  ["Page title", "Is there a title, and is it a sensible length for Google results?"],
  ["Search description", "Is there a meta description for your search listing?"],
  ["Contact info on the page", "Is there a phone number, an email link, a contact page link, and a tap-to-call link for phones?"],
  ["Link to your Google Business Profile", "Does the page link to your Google Maps or Business Profile listing?"],
];

const FAQ = [
  ["What does the audit actually do?", "It loads the one page you enter, the same way a visitor's browser would, and reads the HTML that comes back. Each result tells you what we saw."],
  ["What does it not do?", "It is not a full SEO, speed or design review. It does not measure Google's Core Web Vitals, rankings or traffic, and it only looks at one page. For a deeper speed test, use Google PageSpeed Insights."],
  ["Do you store my website address?", "No. The audit runs when you press the button and does not save your address or ask for your email."],
  ["Does it work on every site?", "No. Some sites block automated visitors or load most of their content with JavaScript, so the results can miss things. If a result looks wrong, call us and we'll check it by hand."],
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Free website audit for your small business</h1>
        <p className="mt-3 text-base text-slate-300">
          Type in your website address and see seven plain checks in seconds. No email, no sales call. If your site needs more
          than a few fixes, we build real, working websites, not subscriptions like the rest, for $1,995 flat.
        </p>
        <div className="mt-8">
          <AuditForm />
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
