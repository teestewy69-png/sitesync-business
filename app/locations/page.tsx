import type { Metadata } from "next";
import LocationsIndex from "@/components/city-launch/LocationsIndex";
import { approvedEntries } from "@/lib/factory/city-launch-public";
import { cityLaunchContext, readCityIndex } from "@/lib/factory/city-launch";
import { DESIGN_STYLES } from "@/lib/design-styles";
import {
  SITESINC_CITY_PROJECT_ID,
  ensureSitesincCityProject,
  sitesincCityLinks,
} from "@/lib/factory/sitesinc-city";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "City pages | Sitesinc",
  description:
    "Unique local pages for U.S. cities, written through City Launch. Each page has to pass a uniqueness gate before it goes live.",
  alternates: { canonical: "/locations" },
};

export default async function SitesincLocationsPage() {
  const project = await ensureSitesincCityProject();
  const ctx = cityLaunchContext(project);
  const style = DESIGN_STYLES.find((d) => d.id === ctx.designStyleId) || DESIGN_STYLES[0];
  const pages = approvedEntries(await readCityIndex(SITESINC_CITY_PROJECT_ID));
  const links = sitesincCityLinks();
  return <LocationsIndex ctx={ctx} style={style} pages={pages} links={links} />;
}
