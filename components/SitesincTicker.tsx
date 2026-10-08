"use client";

import AnnouncementTicker from "@/components/AnnouncementTicker";
import HideOnClientSite from "@/components/HideOnClientSite";

/**
 * Sitesinc's pricing ticker, rendered from a client boundary so its copy is not serialized into the page payload
 * of client sites (a server child of HideOnClientSite would still ship in the RSC data even when hidden).
 * Server-rendered output on Sitesinc's own pages is unchanged.
 */
export default function SitesincTicker() {
  return (
    <HideOnClientSite>
      <AnnouncementTicker />
    </HideOnClientSite>
  );
}
