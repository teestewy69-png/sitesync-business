/**
 * Stable lastmod dates for the public sitemap.
 * Use the last real content edit for that URL (git date of the source file, or a
 * page-specific `updated` field). Do not stamp every URL with the build time.
 */
import { posts } from "@/data/posts";

export const SITE_FALLBACK_LASTMOD = "2026-10-20";

const LASTMOD: Record<string, string> = {
  "/": "2026-10-27",
  "/services": "2026-10-27",
  "/about": "2026-10-27",
  "/contact": "2026-10-20",
  "/blog": "2026-10-27",
  "/privacy": "2026-10-20",
  "/terms": "2026-10-27",
  "/free-website-audit": "2026-10-27",
  "/compare/hibu-alternative": "2026-10-27",
  "/compare/thryv-alternative": "2026-10-27",
  "/compare/web-com-alternative": "2026-10-27",
  "/disclaimer": "2026-10-27",
  "/cookie-policy": "2026-10-27",
  "/dmca": "2026-10-27",
  "/locations": "2026-10-27",
  "/website-design": "2026-10-27",
  "/packages": "2026-10-27",
  "/website-redesign": "2026-10-27",
  "/seo-ready-websites": "2026-10-27",
  "/website-monitoring": "2026-10-27",
  "/for-local-service-businesses": "2026-10-27",
  ...Object.fromEntries(posts.map((p) => [`/blog/${p.slug}`, p.updated ?? p.date])),
};

/** Shared template date for the 500 /locations/<city> pages. */
export const LOCATION_PAGES_LASTMOD = "2026-10-27";

export function lastmodFor(path: string): string {
  if (LASTMOD[path]) return LASTMOD[path];
  if (path.startsWith("/locations/")) return LOCATION_PAGES_LASTMOD;
  return SITE_FALLBACK_LASTMOD;
}
