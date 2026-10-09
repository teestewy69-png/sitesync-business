import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityLanding from "@/components/city-launch/CityLanding";
import { cityPageJsonLd, loadCityLanding } from "@/lib/factory/city-launch-public";
import { SITESINC_CITY_PROJECT_ID, sitesincCityLinks } from "@/lib/factory/sitesinc-city";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ citySlug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { citySlug } = await params;
  const wantPreview = (await searchParams).preview === "1";
  const data = await loadCityLanding(SITESINC_CITY_PROJECT_ID, citySlug, wantPreview);
  if (!data) return { title: "City page" };
  return {
    title: data.draft.content.title,
    description: data.draft.content.metaDescription,
    alternates: { canonical: `/locations/${citySlug}` },
    robots: data.isDraftPreview ? { index: false, follow: false } : undefined,
  };
}

export default async function SitesincCityPage({ params, searchParams }: Params) {
  const { citySlug } = await params;
  const wantPreview = (await searchParams).preview === "1";
  const data = await loadCityLanding(SITESINC_CITY_PROJECT_ID, citySlug, wantPreview);
  if (!data) notFound();
  const links = sitesincCityLinks();
  const jsonLd = cityPageJsonLd(
    data,
    `${links.origin}/locations/${citySlug}`,
    `${links.origin}/locations`,
    links.origin
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <CityLanding data={data} links={links} />
    </>
  );
}
