/**
 * Sitesinc's own City Launch project. ScaleQuan is the only city writer —
 * no second doorway generator. Public pages live at /locations.
 */
import { US_STATE_ROWS } from "@/lib/city-launch/us-cities.generated";
import type { ClientProject } from "@/lib/store";
import { appendProject, findProjectById } from "@/lib/store";
import { pickCities, queueCityLaunchBatch, type QueueBatchResult } from "./city-launch";
import { productionLinks, type ClientSiteLinks } from "./city-launch-public";

export const SITESINC_CITY_PROJECT_ID = "sitesinc";
export const SITESINC_CITY_KEYWORD = "small-business website";
export const SITESINC_CITY_LIMIT = 500;

export const SITESINC_CITY_STATES = US_STATE_ROWS.map((row) => row.split("|")[0]);

export const SITESINC_CITY_WEBSITE_CONTENT = [
  "Sitesinc builds custom Next.js websites for small and local businesses.",
  "Website builds are $1,995 — a flat fee. No negotiation.",
  "Pay $997.50 to start and $997.50 at launch. Submitting the form is a request, not a purchase.",
  "If we accept the project, Sitesinc emails the start invoice. Optional monitoring is $129/month and can be skipped.",
  "We do not promise rankings. Each city page must use real Census facts for that city and must not invent a local office, staff, or reviews.",
  "Contact: save@sitesinc.co. Domain: sitesinc.co.",
].join(" ");

export const SITESINC_CITY_PROMPT =
  "Write a helpful landing page about getting a custom small-business website built for a shop in {city}, {state}. Use a friendly expert tone. Do not invent a Sitesinc office, phone number, staff, reviews, or rankings in that city. The offer is a $1,995 flat-fee website build. The form is a request, not a purchase.";

export function sitesincCityProjectRecord(): ClientProject {
  return {
    id: SITESINC_CITY_PROJECT_ID,
    source: "factory_intake",
    createdAt: "2026-10-09T00:00:00.000Z",
    label: "Sitesinc",
    businessName: "Sitesinc",
    contactName: "Tony",
    email: "save@sitesinc.co",
    niche: SITESINC_CITY_KEYWORD,
    offer: "Custom Next.js website build for small businesses",
    businessType: "Website studio",
    primaryGoal: "leads",
    notes:
      "Internal Sitesinc City Launch. ScaleQuan is the only writer. No invented HQ. Pages go live at /locations after they pass the uniqueness gate and are approved.",
    designStyleId: "neon-glass",
    templateId: "general",
    selectedDomain: "sitesinc.co",
    domainStatus: "client_owned",
    seededPages: [
      { slug: "home", path: "/", title: "Home", purpose: "Sitesinc offer." },
      { slug: "services", path: "/services", title: "Services", purpose: "What the $1,995 build includes." },
      { slug: "about", path: "/about", title: "About", purpose: "Who Sitesinc is for." },
      { slug: "contact", path: "/contact", title: "Contact", purpose: "Build request form." },
    ],
    factoryWorkspaceId: SITESINC_CITY_PROJECT_ID,
  };
}

export async function ensureSitesincCityProject(): Promise<ClientProject> {
  const existing = await findProjectById(SITESINC_CITY_PROJECT_ID);
  if (existing) return existing;
  return appendProject(sitesincCityProjectRecord());
}

export function sitesincCityLinks(origin = "https://sitesinc.co"): ClientSiteLinks {
  return { ...productionLinks("sitesinc.co", { contactPath: "/contact", email: "save@sitesinc.co" }), origin };
}

export async function queueSitesincCityLaunch(actor = "Tony"): Promise<QueueBatchResult & { picked: number }> {
  const project = await ensureSitesincCityProject();
  const pick = pickCities(project, {
    mode: "top_states",
    states: SITESINC_CITY_STATES,
    limit: SITESINC_CITY_LIMIT,
    minPopulation: 1000,
  });
  if (!pick.ok || !pick.cities.length) {
    return { ok: false, error: pick.error || "No Census cities to queue.", picked: 0 };
  }
  const queued = await queueCityLaunchBatch(
    project.id,
    {
      cities: pick.cities,
      keyword: SITESINC_CITY_KEYWORD,
      titleTemplate: "Website build in {city}, {state}",
      promptTemplate: SITESINC_CITY_PROMPT,
      websiteContent: SITESINC_CITY_WEBSITE_CONTENT,
      competitorGaps: "",
      targetWordCount: 700,
      includeFaq: true,
      pickDetail: pick.detail,
      pickMode: "top_states",
    },
    actor
  );
  return { ...queued, picked: pick.cities.length };
}
