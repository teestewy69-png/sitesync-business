import type { Metadata } from "next";
import LocationsIndex from "@/components/city-launch/LocationsIndex";
import { ClientSiteMarker } from "@/components/client-site/ClientSiteShell";
import { requireClientSite } from "@/lib/factory/client-domain";
import { clientPageMetadata, loadClientSiteView } from "@/lib/factory/client-site-view";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = { host: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { host } = await params;
  const site = await requireClientSite(host, "/locations");
  const view = await loadClientSiteView(site);
  const name = view.ctx.business.businessName;
  return clientPageMetadata(site, name, {
    title: `Service areas | ${name}`,
    description: `Cities ${name} serves${view.ctx.business.baseCity ? ` from ${view.ctx.business.baseCity}` : ""}, each with its own local page.`,
    path: "/locations",
  });
}

export default async function ClientDomainLocations({ params }: { params: Promise<Params> }) {
  const { host } = await params;
  const site = await requireClientSite(host, "/locations");
  const view = await loadClientSiteView(site);
  if (!view.cities.length) notFound();
  return (
    <>
      <ClientSiteMarker />
      <LocationsIndex ctx={view.ctx} style={view.style} pages={view.cities} links={view.links} />
    </>
  );
}
