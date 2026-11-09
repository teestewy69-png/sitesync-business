/**
 * Title, description, H1, and local uniqueness helpers for the 20 indexed
 * SoCal city pages. Facts come only from Census data already in the repo
 * (county, coordinates) plus the existing hub routes. No invented clients,
 * reviews, or stats.
 */
import type { UsCity } from "@/lib/city-launch";
import { nearestCities } from "@/lib/city-launch";
import { getIndexableLocationCities, isIndexableLocation } from "@/lib/locations";

export const INDEXED_LOCATION_TITLE_MAX = 60;

const RANCHO_HUB_SLUGS = new Set([
  "rancho-cucamonga-ca",
  "upland-ca",
  "ontario-ca",
  "chino-ca",
]);

const IE_COUNTIES = new Set(["Riverside County", "San Bernardino County"]);

export type NearbyHub = {
  href: string;
  label: string;
};

export function indexedLocationTitle(city: UsCity): string {
  const primary = `Web Design in ${city.name}, ${city.state} | $1,995 Small Business Sites`;
  if (primary.length <= INDEXED_LOCATION_TITLE_MAX) return primary;
  return `${city.name}, ${city.state} Web Design | $1,995 Flat`;
}

export function indexedLocationDescription(city: UsCity): string {
  return `Website design for ${city.name} small businesses: $1,995 flat, $997.50 to start, you own it. Already have a site? Free diagnostic. Call (909) 323-1575.`;
}

export function indexedLocationH1(city: UsCity): string {
  return `Website design for small businesses in ${city.name}, ${city.state}`;
}

/** Generic title used by the 480 noindex city pages (unchanged). */
export function noindexLocationTitle(city: UsCity): string {
  return `Small Business Websites in ${city.name}, ${city.state}`;
}

export function noindexLocationDescription(city: UsCity): string {
  return `Sitesinc builds real, working websites for small businesses in ${city.name}, ${city.state}. $1,995 flat, one time. No long-term contract. You own your website.`;
}

export function noindexLocationH1(city: UsCity): string {
  return `Small business websites in ${city.name}, ${city.state}`;
}

export function locationPageTitle(city: UsCity): string {
  return isIndexableLocation(city.slug) ? indexedLocationTitle(city) : noindexLocationTitle(city);
}

export function locationPageDescription(city: UsCity): string {
  return isIndexableLocation(city.slug) ? indexedLocationDescription(city) : noindexLocationDescription(city);
}

export function locationPageH1(city: UsCity): string {
  return isIndexableLocation(city.slug) ? indexedLocationH1(city) : noindexLocationH1(city);
}

/** Three other keep-list cities, closest by Census coordinates. */
export function neighboringKeepListCities(city: UsCity, limit = 3): UsCity[] {
  return nearestCities(city, getIndexableLocationCities(), limit);
}

/**
 * Nearest existing hub: Rancho Cucamonga hub for Rancho/Upland/Ontario/Chino;
 * Inland Empire hub for other Riverside/San Bernardino County keep-list cities
 * (and Pomona, which sits on the IE edge in Los Angeles County).
 */
export function nearestHubForCity(city: UsCity): NearbyHub | null {
  if (RANCHO_HUB_SLUGS.has(city.slug)) {
    return {
      href: "/rancho-cucamonga-small-business-web-design",
      label: "Rancho Cucamonga small business web design",
    };
  }
  if (IE_COUNTIES.has(city.county) || city.slug === "pomona-ca") {
    return {
      href: "/inland-empire-small-business-website-design",
      label: "Inland Empire small business website design",
    };
  }
  return null;
}
