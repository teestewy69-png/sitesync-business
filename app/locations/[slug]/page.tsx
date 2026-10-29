import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import content from "@/content.json";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import { OG_IMAGE } from "@/lib/og-image";
import { getCityPageCopy } from "@/data/city-page-content";
import { getLocationCities, getLocationCity, locationRobots, locationUrl, relatedCities } from "@/lib/locations";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return getLocationCities().map((c) => ({ slug: c.slug }));
}

const MONITORING =
  "1st month free • Card required at signup • $129/mo starting day 31 unless canceled before 30 days";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const city = getLocationCity(slug);
  if (!city) return {};
  const title = `Small Business Websites in ${city.name}, ${city.state}`;
  const description = `Sitesinc builds real, working websites for small businesses in ${city.name}, ${city.state}. $1,995 flat, one time. No long-term contract. You own your website.`;
  const url = locationUrl(city.slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: locationRobots(slug),
    openGraph: { title, description, url, type: "website", images: [OG_IMAGE] },
  };
}

export default async function LocationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const city = getLocationCity(slug);
  if (!city) notFound();
  const related = relatedCities(city);
  const place = `${city.name}, ${city.state}`;
  const pop = new Intl.NumberFormat("en-US").format(city.population);
  const url = locationUrl(city.slug);
  const local = getCityPageCopy(slug);

  const faqs = local?.faqs ?? [
    {
      q: `How much does a website cost for a business in ${place}?`,
      a: `The Sitesinc website build is $1,995, a flat one-time price. You pay 50% ($997.50) to start and 50% ($997.50) at launch. Optional monitoring is separate: ${MONITORING}.`,
    },
    {
      q: "Is there a long-term contract?",
      a: "No. There is no long-term contract, and you do not need a subscription to keep your website live. Optional monitoring can be canceled.",
    },
    {
      q: "Do I own my website?",
      a: "Yes. You get the full code and your content when the build is complete. Your website is yours.",
    },
    {
      q: "Is submitting the form a purchase?",
      a: "No. Submitting the form is a request, not a purchase. If we accept your project, we email a $997.50 start invoice. The remaining $997.50 is due at launch.",
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Sitesinc", item: "https://sitesinc.co" },
        { "@type": "ListItem", position: 2, name: "Locations", item: "https://sitesinc.co/locations" },
        { "@type": "ListItem", position: 3, name: place, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <SitePage>
      <OrgJsonLd />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-4xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <Link href="/" className="hover:text-brand-300">Sitesinc</Link> ›{" "}
          <Link href="/locations" className="hover:text-brand-300">Locations</Link> › {place}
        </nav>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-300">{place}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Small business websites in {place}
        </h1>
        <p className="mt-4 text-base text-slate-300">
          We build real, working websites, not subscriptions like the rest. For $1,995 flat, a {city.name}{" "}
          business gets affordable website design it owns outright — the same build we do for contractors,
          plumbers, and barbers.
        </p>
        <p className="mt-3 text-base text-slate-300">
          {city.name} is a city in {city.stateName} with an estimated {pop} residents (U.S. Census Bureau, 2024
          estimate). Sitesinc is based in {content.footer.address.city}, {content.footer.address.region} and builds
          websites online, so we work with small businesses in {city.name} without an in-person visit.
        </p>
        {local ? (
          <>
            <p className="mt-3 text-base text-slate-300">{local.intro}</p>
            <section className="mt-10">
              <h2 className="text-xl font-semibold">{local.tradesHeading}</h2>
              <p className="mt-3 text-base text-slate-300">{local.trades}</p>
            </section>
            <section className="mt-10">
              <h2 className="text-xl font-semibold">{local.areasHeading}</h2>
              <p className="mt-3 text-base text-slate-300">{local.areas}</p>
            </section>
          </>
        ) : null}

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Our guarantee, in plain terms</h2>
          <ul className="mt-3 space-y-2 text-base text-slate-300">
            <li><strong className="text-slate-100">Flat $1,995, one time.</strong> 50% to start, 50% at launch.</li>
            <li><strong className="text-slate-100">No long-term contract.</strong> No subscription is required to keep your site live.</li>
            <li><strong className="text-slate-100">You own your website.</strong> You receive the full code and content.</li>
          </ul>
          <p className="mt-3 text-sm text-slate-400">
            Optional monitoring is not part of the build: {MONITORING}.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What the $1,995 build includes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-slate-300">
            {content.included.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Website basics for a {city.name} business</h2>
          <p className="mt-3 text-base text-slate-300">
            These are general best practices for any local business, not claims about results:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-slate-300">
            <li>Put your business name, address, phone number and hours on the site exactly as they appear on your Google Business Profile.</li>
            <li>Name {city.name} and {city.stateName} in your page titles and headings so people and search engines know where you work.</li>
            <li>Make the phone number a tap-to-call link and keep the contact form short, since many local searches happen on a phone.</li>
            <li>List your real services and prices, or say how to request an estimate.</li>
            <li>Show only reviews from real customers, and only with their permission.</li>
          </ul>
          <p className="mt-3 text-sm text-slate-400">
            No one can promise a search ranking, and we do not. A clearer, faster website is what we deliver.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-black p-6 text-center">
          <h2 className="text-xl font-semibold">Request a website for your {city.name} business</h2>
          <p className="mx-auto mt-2 max-w-xl text-base text-slate-300">
            Submitting the form is a request, not a purchase. If we accept your project, we email a $997.50 start invoice.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-400">
            Read{" "}
            <Link href="/website-design" className="text-brand-300 hover:underline">
              affordable website design
            </Link>{" "}
            and{" "}
            <Link href="/packages" className="text-brand-300 hover:underline">
              packages
            </Link>{" "}
            for what is included and how the $1,995 invoices work.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950"
            >
              See pricing &amp; request a build
            </Link>
            <a
              href={content.footer.phoneHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-2.5 text-sm font-medium text-slate-100"
            >
              Call {content.footer.phone}
            </a>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Or email <a className="text-brand-300 hover:underline" href={`mailto:${content.footer.email}`}>{content.footer.email}</a>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-base font-semibold text-slate-100">{f.q}</h3>
                <p className="mt-1 text-base text-slate-300">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Other {city.stateName} locations</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {related.map((c) => (
                <li key={c.slug}>
                  <Link href={`/locations/${c.slug}`} className="text-brand-300 hover:underline">
                    Websites in {c.name}, {c.state}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </SitePage>
  );
}
