import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import { OG_IMAGE } from "@/lib/og-image";
import { getLocationCities, LOCATIONS_ORIGIN } from "@/lib/locations";

const title = "Locations: Small Business Websites Across the U.S. | Sitesinc";
const description =
  "Sitesinc builds real, working websites for small businesses across the U.S. for a flat $1,995, one time. Find your city.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/locations` },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: `${LOCATIONS_ORIGIN}/locations`, images: [OG_IMAGE] },
};

export default function LocationsIndex() {
  const byState = new Map<string, { name: string; slug: string; label: string }[]>();
  for (const c of getLocationCities()) {
    const list = byState.get(c.stateName) ?? [];
    list.push({ name: c.name, slug: c.slug, label: `${c.name}, ${c.state}` });
    byState.set(c.stateName, list);
  }
  const states = [...byState.keys()].sort();

  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Locations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Small business websites across the U.S.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          We build real, working websites, not subscriptions like the rest. For $1,995 flat, one time. No long-term
          contract, and you own your website. Sitesinc builds websites online, so pick your city to see the details.
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((state) => (
            <div key={state}>
              <h2 className="text-lg font-semibold text-slate-100">{state}</h2>
              <ul className="mt-2 space-y-1 text-base">
                {byState.get(state)!.sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/locations/${c.slug}`} className="text-brand-300 hover:underline">
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </SitePage>
  );
}
