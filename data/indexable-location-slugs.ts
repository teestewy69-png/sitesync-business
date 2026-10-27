/**
 * Markets that stay index,follow on /locations/<slug>.
 * Edit this array to keep or drop cities. Every other city page stays live
 * (200, crawlable, linked from /locations) with robots noindex,follow and
 * is omitted from sitemap.xml. Do not add those slugs to robots.txt.
 */
export const INDEXABLE_LOCATION_SLUGS = [
  "anaheim-ca",
  "chino-ca",
  "corona-ca",
  "costa-mesa-ca",
  "fontana-ca",
  "garden-grove-ca",
  "huntington-beach-ca",
  "irvine-ca",
  "long-beach-ca",
  "los-angeles-ca",
  "newport-beach-ca",
  "ontario-ca",
  "orange-ca",
  "pomona-ca",
  "rancho-cucamonga-ca",
  "riverside-ca",
  "san-bernardino-ca",
  "san-diego-ca",
  "santa-ana-ca",
  "upland-ca",
] as const;

export type IndexableLocationSlug = (typeof INDEXABLE_LOCATION_SLUGS)[number];
