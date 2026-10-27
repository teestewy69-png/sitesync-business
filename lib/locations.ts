import { LOCATION_SLUGS as slugs } from "@/data/location-slugs";
import { getUsCityIndex, type UsCity } from "@/lib/city-launch";

export const LOCATIONS_ORIGIN = "https://sitesinc.co";

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
