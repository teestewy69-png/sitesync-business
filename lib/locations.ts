import { INDEXABLE_LOCATION_SLUGS } from "@/data/indexable-location-slugs";
import { LOCATION_SLUGS as slugs } from "@/data/location-slugs";
import { getUsCityIndex, type UsCity } from "@/lib/city-launch";

export const LOCATIONS_ORIGIN = "https://sitesinc.co";

export { INDEXABLE_LOCATION_SLUGS };

const INDEXABLE = new Set<string>(INDEXABLE_LOCATION_SLUGS);

/** The 500 cities with a Sitesinc location page. Facts come only from U.S. Census Bureau data (public domain). */
export function getLocationCities(): UsCity[] {
  const index = getUsCityIndex();
  const out: UsCity[] = [];
  for (const slug of slugs as string[]) {
    const city = index.bySlug.get(slug);
    if (city) out.push(city);
  }
  return out;
}

/** True only for slugs in INDEXABLE_LOCATION_SLUGS (the owner keep-list). */
export function isIndexableLocation(slug: string): boolean {
  return INDEXABLE.has(slug);
}

/** City pages Tony wants in the sitemap and index,follow. */
export function getIndexableLocationCities(): UsCity[] {
  return getLocationCities().filter((c) => isIndexableLocation(c.slug));
}

/** index,follow for the keep-list; noindex,follow for the rest (still crawlable). */
export function locationRobots(slug: string): { index: boolean; follow: boolean } {
  return { index: isIndexableLocation(slug), follow: true };
}

export function getLocationCity(slug: string): UsCity | undefined {
  if (!slugs.includes(slug)) return undefined;
  return getUsCityIndex().bySlug.get(slug);
}

/** Up to `limit` other location pages in the same state, closest in population first. */
export function relatedCities(city: UsCity, limit = 6): UsCity[] {
  return getLocationCities()
    .filter((c) => c.state === city.state && c.slug !== city.slug)
    .sort((a, b) => Math.abs(a.population - city.population) - Math.abs(b.population - city.population))
    .slice(0, limit);
}

export function locationUrl(slug: string): string {
  return `${LOCATIONS_ORIGIN}/locations/${slug}`;
}
