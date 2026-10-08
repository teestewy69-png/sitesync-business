import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityLanding from "@/components/city-launch/CityLanding";
import { ClientSiteMarker } from "@/components/client-site/ClientSiteShell";
import { cityPageJsonLd, loadCityLanding } from "@/lib/factory/city-launch-public";
import { requireClientSite } from "@/lib/factory/client-domain";
import { clientPageMetadata, loadClientSiteView } from "@/lib/factory/client-site-view";

export const dynamic = "force-dynamic";

type Params = { host: string; citySlug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { host, citySlug } = await params;
  const site = await requireClientSite(host, `/locations/${citySlug}`);
  // Public pages only: approved + gate not blocked (no ?preview on the real domain).
  const data = await loadCityLanding(site.project.id, citySlug, false);
  if (!data) return { title: "Not found", robots: { index: false, follow: false } };
  return clientPageMetadata(site, data.ctx.business.businessName, {
    title: data.draft.content.title,
    description: data.draft.content.metaDescription,
    path: `/locations/${citySlug}`,
  });
}

export default async function ClientDomainCityPage({ params }: { params: Promise<Params> }) {
  const { host, citySlug } = await params;
  const site = await requireClientSite(host, `/locations/${citySlug}`);
  const data = await loadCityLanding(site.project.id, citySlug, false);
  if (!data) notFound();
  const view = await loadClientSiteView(site);
  const url = `${site.origin}/locations/${citySlug}`;
  const jsonLd = cityPageJsonLd(data, url, `${site.origin}/locations`, `${site.origin}/`);
  return (
    <>
      <ClientSiteMarker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <CityLanding data={data} links={view.links} />
    </>
  );
}
