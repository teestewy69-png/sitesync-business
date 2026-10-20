/**
 * City Launch public reads for the client preview site (/demo/client/[projectId]/locations/...).
 * Only APPROVED pages whose quality gate is not "block" are served publicly. A signed-in factory operator
 * can add ?preview=1 to see a draft (noindex, labeled).
 */
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { haversineMiles } from "@/lib/city-launch";
import type { CityDraft, CityIndexEntry, CityLaunchIndex } from "@/lib/city-launch/job";
import { DESIGN_STYLES, type DesignStyle } from "@/lib/design-styles";
import { findProjectById, type ClientProject } from "@/lib/store";
import { FACTORY_COOKIE, isValidSession } from "./auth";
import { cityLaunchContext, readCityDraft, readCityIndex, type CityLaunchClientContext } from "./city-launch";

export function isPublishable(entry: CityIndexEntry | undefined): entry is CityIndexEntry {
  return Boolean(entry && entry.status === "approved" && entry.gate && entry.gate.status !== "block");
}

export function approvedEntries(index: CityLaunchIndex | null): CityIndexEntry[] {
  return Object.values(index?.pages || {})
    .filter(isPublishable)
    .sort((a, b) => a.state.localeCompare(b.state) || b.population - a.population || a.name.localeCompare(b.name));
}

export async function isOperatorSession(): Promise<boolean> {
  try {
    const jar = await cookies();
    return await isValidSession(jar.get(FACTORY_COOKIE)?.value);
  } catch (err) {
    unstable_rethrow(err);
    return false;
  }
}

export type CityLandingData = {
  project: ClientProject;
  ctx: CityLaunchClientContext;
  style: DesignStyle;
  draft: CityDraft;
  entry: CityIndexEntry;
  isDraftPreview: boolean;
  nearbyLive: Array<CityIndexEntry & { distanceMiles: number }>;
  approvedCount: number;
  productionDomain: string | null;
};

export async function loadCityLanding(projectId: string, slug: string, wantPreview: boolean): Promise<CityLandingData | null> {
  try {
    const project = await findProjectById(projectId);
    if (!project) return null;
    const index = await readCityIndex(projectId);
    const entry = index?.pages[slug];
    if (!entry) return null;
    let isDraftPreview = false;
    if (!isPublishable(entry)) {
      if (!wantPreview || !(await isOperatorSession())) return null;
      isDraftPreview = true;
    }
    const draft = await readCityDraft(projectId, slug);
    if (!draft) return null;
    const ctx = cityLaunchContext(project);
    const style = DESIGN_STYLES.find((s) => s.id === ctx.designStyleId) || DESIGN_STYLES[0];
    const live = approvedEntries(index);
    const nearbyLive =
      entry.lat !== null && entry.lng !== null
        ? live
            .filter((p) => p.slug !== slug && p.lat !== null && p.lng !== null)
            .map((p) => ({ ...p, distanceMiles: Math.round(haversineMiles({ lat: entry.lat!, lng: entry.lng! }, { lat: p.lat!, lng: p.lng! }) * 10) / 10 }))
            .sort((a, b) => a.distanceMiles - b.distanceMiles)
            .slice(0, 8)
        : live.filter((p) => p.slug !== slug).slice(0, 8).map((p) => ({ ...p, distanceMiles: 0 }));
    const production = index?.production?.status === "signed_off" ? index.production.domain || null : null;
    return { project, ctx, style, draft, entry, isDraftPreview, nearbyLive, approvedCount: live.length, productionDomain: production };
  } catch (err) {
    unstable_rethrow(err);
    console.error("loadCityLanding fallback:", err instanceof Error ? err.name : "unknown");
    return null;
  }
}

const NICHE_SCHEMA: Array<[RegExp, string]> = [
  [/plumb/i, "Plumber"],
  [/hvac|heating|air cond/i, "HVACBusiness"],
  [/electric/i, "Electrician"],
  [/roof/i, "RoofingContractor"],
  [/locksmith/i, "Locksmith"],
  [/landscap|lawn/i, "LandscapingBusiness"],
  [/paint/i, "HousePainter"],
  [/contractor|remodel|construction/i, "GeneralContractor"],
  [/dent/i, "Dentist"],
  [/law|attorney/i, "LegalService"],
  [/barber|salon|hair/i, "HairSalon"],
  [/moving|movers/i, "MovingCompany"],
  [/real estate|realtor|houses/i, "RealEstateAgent"],
];

export function schemaTypeForNiche(niche: string): string {
  for (const [re, type] of NICHE_SCHEMA) if (re.test(niche)) return type;
  return "LocalBusiness";
}

export function cityPageJsonLd(data: CityLandingData, pageUrl: string, locationsUrl: string, homeUrl: string) {
  const { ctx, draft } = data;
  const business: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaTypeForNiche(ctx.business.niche),
    "@id": `${pageUrl}#business`,
    name: ctx.business.businessName,
    url: pageUrl,
    description: draft.content.metaDescription,
    areaServed: {
      "@type": "City",
      name: draft.city.name,
      containedInPlace: { "@type": "State", name: draft.city.stateName },
      ...(draft.city.lat !== null && draft.city.lng !== null
        ? { geo: { "@type": "GeoCoordinates", latitude: draft.city.lat, longitude: draft.city.lng } }
        : {}),
    },
  };
  if (ctx.business.phone) business.telephone = ctx.business.phone;
  if (ctx.business.baseCity) {
    business.address = {
      "@type": "PostalAddress",
      addressLocality: ctx.business.baseCity,
      addressRegion: ctx.business.baseState,
      addressCountry: "US",
    };
  }
  const graph: Record<string, unknown>[] = [
    business,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: ctx.business.businessName, item: homeUrl },
        { "@type": "ListItem", position: 2, name: "Locations", item: locationsUrl },
        { "@type": "ListItem", position: 3, name: `${draft.city.name}, ${draft.city.state}`, item: pageUrl },
      ],
    },
  ];
  if (draft.content.faq.length) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: draft.content.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }
  return graph;
}

/** Visual tokens per bound design style (same ids as lib/design-styles.ts). */
export type CityTheme = {
  variant: "center" | "split";
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  dark: boolean;
  headingScale: number;
};

export function cityTheme(style: DesignStyle): CityTheme {
  switch (style.id) {
    case "split-hero":
      return { variant: "split", bg: "#f6f8f5", surface: "#ffffff", text: "#0f1a12", muted: "#4b5a50", border: "rgba(15,26,18,0.12)", dark: false, headingScale: 1 };
    case "card-grid":
      return { variant: "center", bg: "#fbf8f1", surface: "#ffffff", text: "#1d1a12", muted: "#5d5646", border: "rgba(29,26,18,0.12)", dark: false, headingScale: 1 };
    case "funnel-ready":
      return { variant: "split", bg: "#fff7f7", surface: "#ffffff", text: "#1f0d10", muted: "#6b4b50", border: "rgba(31,13,16,0.12)", dark: false, headingScale: 1.05 };
    case "bold-type":
      return { variant: "center", bg: "#060b1a", surface: "rgba(255,255,255,0.05)", text: "#f2f5ff", muted: "#a5b0cc", border: "rgba(255,255,255,0.12)", dark: true, headingScale: 1.25 };
    case "purple-gradient":
      return { variant: "center", bg: "#120a1f", surface: "rgba(255,255,255,0.06)", text: "#f6f0ff", muted: "#c0b2d9", border: "rgba(255,255,255,0.12)", dark: true, headingScale: 1.05 };
    case "minimal-dark":
      return { variant: "split", bg: "#0b0b0c", surface: "rgba(255,255,255,0.04)", text: "#f4f4f5", muted: "#a1a1aa", border: "rgba(255,255,255,0.1)", dark: true, headingScale: 1 };
    case "photo-focus":
      return { variant: "split", bg: "#0e0a0d", surface: "rgba(255,255,255,0.05)", text: "#fdf2f8", muted: "#c9a9bc", border: "rgba(255,255,255,0.12)", dark: true, headingScale: 1.05 };
    case "neon-glass":
    default:
      return { variant: "center", bg: "#07070b", surface: "rgba(255,255,255,0.05)", text: "#f5f5f7", muted: "#a8a8b3", border: "rgba(255,255,255,0.12)", dark: true, headingScale: 1.05 };
  }
}

export function previewBase(projectId: string) {
  return `/demo/client/${projectId}`;
}

/**
 * Where links on a client page point. Preview = /demo/client/<id>/... on a Sitesinc host (noindex, banner);
 * production = the client's own domain after sign-off (indexable, no Sitesinc chrome, root-relative links).
 */
export type ClientSiteLinks = {
  mode: "preview" | "production";
  /** Absolute origin used for canonical / JSON-LD / sitemap links. */
  origin: string;
  home: string;
  locations: string;
  city: (slug: string) => string;
  /** null = no publishable contact page; the CTA falls back to phone / email. */
  contact: string | null;
  email?: string;
  sitemap: string;
};

export function previewLinks(projectId: string, ctx: CityLaunchClientContext, origin: string): ClientSiteLinks {
  const base = previewBase(projectId);
  return {
    mode: "preview",
    origin,
    home: base,
    locations: `${base}/locations`,
    city: (slug) => `${base}/locations/${slug}`,
    contact: ctx.contactPath,
    sitemap: `${origin}${base}/sitemap.xml`,
  };
}

export function productionLinks(domain: string, opts: { contactPath: string | null; email?: string }): ClientSiteLinks {
  return {
    mode: "production",
    origin: `https://${domain}`,
    home: "/",
    locations: "/locations",
    city: (slug) => `/locations/${slug}`,
    contact: opts.contactPath,
    email: opts.email,
    sitemap: "/sitemap.xml",
  };
}

/** Map a client page path (`/contact`) onto preview (`/demo/client/<id>/contact`) or production (`/contact`). */
export function clientPageHref(links: ClientSiteLinks, path: string): string {
  if (links.mode !== "preview") return path || "/";
  const base = links.home.replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
