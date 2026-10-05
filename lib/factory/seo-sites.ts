import { PUBLIC_PATHS, PRODUCTION_ORIGIN } from "./pipeline";
import { FACTORY_PROJECT_ID } from "./types";

export type SeoCatalogKind = "production" | "internal_demo" | "client_preview";

export type SeoCatalogSite = {
  id: string;
  name: string;
  origin: string;
  kind: SeoCatalogKind;
  crawlPaths: readonly string[];
  note: string;
  /** CRM / factory client project id when kind is client_preview. */
  clientProjectId?: string;
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

const STATIC_IDS = new Set(SEO_SITE_CATALOG.map((site) => site.id));

/** Static catalog lookup — undefined when id is unknown (e.g. a client project). */
export function findCatalogSite(id?: string): SeoCatalogSite | undefined {
  if (!id) return undefined;
  return SEO_SITE_CATALOG.find((site) => site.id === id);
}

/**
 * Legacy helper: defaults to the Sitesinc case study when id is missing/unknown.
 * Prefer findCatalogSite / buildClientSeoSite for client project ids so we never
 * silently borrow Sitesinc crawlPaths or origin.
 */
export function catalogSite(id?: string): SeoCatalogSite {
  return findCatalogSite(id) || SEO_SITE_CATALOG[0];
}

export function isStaticCatalogSiteId(id: string): boolean {
  return STATIC_IDS.has(id);
}

export function originKey(origin: string) {
  return origin.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase() || "site";
}

/** Host origin (scheme + host, no path) used to build client preview URLs. */
export function hostOriginFrom(input?: string): string {
  const raw = (input || process.env.NEXT_PUBLIC_SITE_URL || PRODUCTION_ORIGIN).replace(/\/$/, "");
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

/** Preview origin for a client deliverable: {host}/demo/client/{projectId} */
export function clientPreviewOrigin(projectId: string, hostOrigin?: string): string {
  const host = hostOriginFrom(hostOrigin);
  return `${host}/demo/client/${encodeURIComponent(projectId)}`;
}

/**
 * Crawl paths under the client preview origin.
 * Home is "/"; other seeded pages use "/{slug}" so they match /demo/client/[projectId]/[slug].
 */
export function clientCrawlPaths(
  pages: Array<{ slug: string; path?: string }> | undefined
): string[] {
  if (!pages?.length) return ["/"];
  const paths = pages.map((page) => {
    if (page.slug === "home" || page.path === "/") return "/";
    const fromPath = (page.path || "").trim();
    if (fromPath && fromPath !== "/") {
      return fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
    }
    return `/${page.slug}`;
  });
  return [...new Set(paths)];
}

export function buildClientSeoSite(input: {
  projectId: string;
  businessName: string;
  crawlPaths?: readonly string[];
  hostOrigin?: string;
}): SeoCatalogSite {
  const origin = clientPreviewOrigin(input.projectId, input.hostOrigin);
  return {
    id: input.projectId,
    name: input.businessName || `Client ${input.projectId}`,
    origin,
    kind: "client_preview",
    crawlPaths: input.crawlPaths?.length ? input.crawlPaths : ["/"],
    clientProjectId: input.projectId,
    note:
      "Per-client deliverable preview (/demo/client/<projectId>). Internal noindex. Baseline belongs only to this client — never borrowed from Sitesinc or demo fixtures.",
  };
}
