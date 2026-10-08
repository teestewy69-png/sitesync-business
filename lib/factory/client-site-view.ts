/** Everything a page on a client's real domain needs (after requireClientSite), plus its metadata. */
import type { Metadata } from "next";
import type { CityIndexEntry } from "@/lib/city-launch/job";
import { DESIGN_STYLES, type DesignStyle } from "@/lib/design-styles";
import { approvedEntries, productionLinks, type ClientSiteLinks } from "./city-launch-public";
import { cityLaunchContext, type CityLaunchClientContext } from "./city-launch";
import { configFromProject } from "./client-config";
import { loadPublishedPages, type ClientSite, type PublishedClientPage } from "./client-domain";

export type ClientSiteView = {
  site: ClientSite;
  ctx: CityLaunchClientContext;
  style: DesignStyle;
  pages: PublishedClientPage[];
  cities: CityIndexEntry[];
  links: ClientSiteLinks;
};

export async function loadClientSiteView(site: ClientSite): Promise<ClientSiteView> {
  const ctx = cityLaunchContext(site.project);
  const style = DESIGN_STYLES.find((d) => d.id === ctx.designStyleId) || DESIGN_STYLES[0];
  const pages = await loadPublishedPages(site.project.id);
  const cities = approvedEntries(site.index);
  const email = (configFromProject(site.project).email || "").trim();
  const links = productionLinks(site.domain, {
    contactPath: pages.some((p) => p.slug === "contact") ? "/contact" : null,
    email: email || undefined,
  });
  return { site, ctx, style, pages, cities, links };
}

/**
 * Indexable metadata on the client's own domain. Overrides every Sitesinc default from the root layout
 * (canonical, Open Graph site name and image, Twitter card) so nothing of Sitesinc leaks into the client's pages.
 */
export function clientPageMetadata(site: ClientSite, businessName: string, page: { title: string; description: string; path: string }): Metadata {
  const url = `${site.origin}${page.path === "/" ? "/" : page.path}`;
  return {
    metadataBase: new URL(site.origin),
    title: { absolute: page.title },
    description: page.description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: { title: page.title, description: page.description, url, siteName: businessName, type: "website", images: [] },
    twitter: { card: "summary", title: page.title, description: page.description, images: [] },
  };
}
