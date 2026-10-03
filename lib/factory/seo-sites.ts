import { PUBLIC_PATHS, PRODUCTION_ORIGIN } from "./pipeline";
import { FACTORY_PROJECT_ID } from "./types";

export type SeoCatalogKind = "production" | "internal_demo";

export type SeoCatalogSite = {
  id: string;
  name: string;
  origin: string;
  kind: SeoCatalogKind;
  crawlPaths: readonly string[];
  note: string;
};

export const SEO_SITE_CATALOG: SeoCatalogSite[] = [
  {
    id: FACTORY_PROJECT_ID,
    name: "Sitesinc Growth Case Study",
    origin: PRODUCTION_ORIGIN,
    kind: "production",
    crawlPaths: PUBLIC_PATHS,
    note: "Live public Sitesinc property. Internal crawl only — not a Google submission.",
  },
  {
    id: "smith-plumbing",
    name: "Smith Plumbing & Heating",
    origin: `${PRODUCTION_ORIGIN}/demo/smith-plumbing`,
    kind: "internal_demo",
    crawlPaths: ["/", "/emergency", "/services", "/contact"],
    note: "Internal noindex demo for multi-site SEO tests. Not a Google property and not in the sitemap.",
  },
  {
    id: "kurtis",
    name: "Kurtis — artist portfolio",
    origin: `${PRODUCTION_ORIGIN}/demo/kurtis`,
    kind: "internal_demo",
    crawlPaths: ["/", "/portfolio", "/about", "/exhibitions", "/contact"],
    note: "Internal artist-portfolio preview. noindex. Not the live Kurtis domain, not a Google property, and not in the sitemap.",
  },
];

export function catalogSite(id?: string): SeoCatalogSite {
  return SEO_SITE_CATALOG.find((site) => site.id === id) || SEO_SITE_CATALOG[0];
}

export function originKey(origin: string) {
  return origin.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase() || "site";
}
