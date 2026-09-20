export const PRODUCTION_SURFACES = [
  {
    id: "homepage",
    label: "Revised homepage",
    paths: ["/"],
    slugs: [] as string[],
    note: "Selecting this records intent only. The live homepage is not replaced from the factory.",
  },
  {
    id: "pricing_intake",
    label: "Pricing and intake flow",
    paths: ["/#pricing", "/#checklist"],
    slugs: [] as string[],
    note: "Already on the current homepage. No new public route.",
  },
  {
    id: "service_pages",
    label: "Service / package pages",
    paths: [
      "/website-design",
      "/packages",
      "/website-redesign",
      "/seo-ready-websites",
      "/website-monitoring",
    ],
    slugs: [
      "website-design",
      "packages",
      "website-redesign",
      "seo-ready-websites",
      "website-monitoring",
    ],
    note: "Staged factory drafts. Go public only after this surface is approved and Netlify production is deployed.",
  },
  {
    id: "industry_pages",
    label: "Industry pages",
    paths: ["/for-local-service-businesses"],
    slugs: ["for-local-service-businesses"],
    note: "One industry explainer. No city doorway clones.",
  },
  {
    id: "process_faq",
    label: "Process and FAQ",
    paths: ["/#process", "/#faq"],
    slugs: [] as string[],
    note: "Already on the current homepage.",
  },
  {
    id: "case_study",
    label: "Initial case-study page",
    paths: ["/case-study"],
    slugs: [] as string[],
    note: "Stays noindex and labeled in progress. No ranking, indexing, backlink, or conversion claims.",
  },
] as const;

export type ProductionSurfaceId = (typeof PRODUCTION_SURFACES)[number]["id"];

export function slugsForSurfaces(ids: string[]): string[] {
  const selected = new Set(ids);
  return PRODUCTION_SURFACES.filter((surface) => selected.has(surface.id)).flatMap(
    (surface) => [...surface.slugs]
  );
}
