import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityLanding from "@/components/city-launch/CityLanding";
import { cityPageJsonLd, loadCityLanding, previewBase } from "@/lib/factory/city-launch-public";
import { requestOrigin } from "@/lib/factory/request-origin";

export const dynamic = "force-dynamic";

type Params = { projectId: string; citySlug: string };
type Search = { preview?: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { projectId, citySlug } = await params;
  const { preview } = await searchParams;
  const data = await loadCityLanding(projectId, citySlug, preview === "1");
  if (!data) return { title: "Not found", robots: { index: false, follow: false } };
  const origin = await requestOrigin();
  const previewUrl = `${origin}${previewBase(projectId)}/locations/${citySlug}`;
  const canonical = data.productionDomain ? `https://${data.productionDomain}/locations/${citySlug}/` : previewUrl;
  return {
    title: { absolute: data.draft.content.title },
    description: data.draft.content.metaDescription,
    // Preview host is never indexed; the client's real domain is where these pages rank.
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title: data.draft.content.title,
      description: data.draft.content.metaDescription,
      type: "website",
      url: canonical,
    },
  };
}

export default async function CityLandingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { projectId, citySlug } = await params;
  const { preview } = await searchParams;
  const data = await loadCityLanding(projectId, citySlug, preview === "1");
  if (!data) notFound();
  const origin = await requestOrigin();
  const base = `${origin}${previewBase(projectId)}`;
  const jsonLd = cityPageJsonLd(data, `${base}/locations/${citySlug}`, `${base}/locations`, base);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <CityLanding data={data} origin={origin} />
    </>
  );
}
