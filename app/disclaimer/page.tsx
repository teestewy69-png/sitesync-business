import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/og-image";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";

export const metadata: Metadata = {
  title: "Disclaimer, Affiliate & Earnings Disclosure | Sitesinc",
  description:
    "Service, SEO performance, pricing, and FTC affiliate disclosures for Sitesinc (sitesinc.co).",
  alternates: { canonical: "/disclaimer" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Disclaimer, Affiliate & Earnings Disclosure | Sitesinc",
    description:
      "Service, SEO performance, pricing, and FTC affiliate disclosures for Sitesinc (sitesinc.co).",
    url: "/disclaimer",
    images: [OG_IMAGE],
  },
};

export default function DisclaimerPage() {
  return (
    <SitePage>
      <OrgJsonLd />
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Disclaimer &amp; Disclosures
        </h1>
        <p className="mt-3 text-base text-slate-400">
          Effective date: October 23, 2026
        </p>

        <div className="mt-8 space-y-8 text-base leading-7 text-slate-300">
          <section>
            <p>
              This Disclaimer &amp; Disclosure policy applies to Sitesinc (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) and our website at{" "}
              <span className="text-slate-100">sitesinc.co</span>, including our{" "}
              <Link href="/locations" className="text-sky-400 underline">
                500 U.S. city web design &amp; local SEO guides
              </Link>
              , blog articles, and client factory tools.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              1. No Guarantee of Specific Search Rankings or Revenue
            </h2>
            <p className="mt-2">
              Sitesinc builds custom, search-engine-optimized websites with clean technical architecture, mobile-first performance, structured schema markup, and local SEO foundations for a flat $99 build fee. While our sites are engineered to follow search engine best practices, search engine algorithms (Google, Bing), local competition, domain age, and customer review velocity are outside our control. Accordingly, we do not guarantee specific keyword rankings, organic traffic volumes, lead counts, or revenue outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              2. Informational &amp; Educational Local Market Guides
            </h2>
            <p className="mt-2">
              Our local business website guides (<Link href="/locations" className="text-sky-400 underline">/locations</Link>) and{" "}
              <Link href="/blog" className="text-sky-400 underline">blog articles</Link> provide general digital marketing, web design, and local SEO information. They do not constitute legal, tax, or regulated financial advice for your business.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              3. Third-Party Tools &amp; Affiliate Disclosure (FTC 16 CFR Part 255)
            </h2>
            <p className="mt-2">
              In compliance with Federal Trade Commission (FTC) guidelines, some articles or digital properties operated or built by Sitesinc may reference third-party software, hosting providers, domain registrars, or business tools. Where an outbound referral or affiliate link is used, we may receive a referral commission at no extra cost to the buyer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              4. Contact &amp; Related Legal Policies
            </h2>
            <p className="mt-2">
              Questions about this Disclaimer may be sent through our{" "}
              <Link href="/contact" className="text-sky-400 underline">contact page</Link>. Also review our{" "}
              <Link href="/privacy" className="text-sky-400 underline">Privacy Policy</Link>,{" "}
              <Link href="/terms" className="text-sky-400 underline">Terms of Service</Link>,{" "}
              <Link href="/cookie-policy" className="text-sky-400 underline">Cookie Policy</Link>, and{" "}
              <Link href="/dmca" className="text-sky-400 underline">DMCA Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </SitePage>
  );
}
