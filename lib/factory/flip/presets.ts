/** Flip-site (build-to-sell) presets. Pure data; no network. */

export type SiteMode = "client" | "flip";
export const SITE_MODES: SiteMode[] = ["client", "flip"];
export const FLIP_GOAL = "Build to sell";

export function normalizeSiteMode(raw: unknown): SiteMode {
  return String(raw || "").trim().toLowerCase() === "flip" ? "flip" : "client";
}

export type FlipCalculator = { slug: string; title: string; inputs: string[]; formula: string };
export type FlipNichePreset = {
  id: string;
  label: string;
  match: RegExp;
  audience: string;
  calculators: FlipCalculator[];
  guideTopics: string[];
  cityPageTitle: string;
  articlesPerMonth: number;
  states: string[];
};

export const FLIP_NICHE_PRESETS: FlipNichePreset[] = [
  {
    id: "house-flipping",
    label: "house flipping / real-estate investing",
    match: /house.?flip|fix.?and.?flip|real.?estate.?invest|rehab|brrrr|flipradar/i,
    audience: "house flippers and small real-estate investors",
    calculators: [
      { slug: "arv-calculator", title: "ARV Calculator", inputs: ["comp prices", "sq ft"], formula: "ARV = avg comp $/sqft x subject sqft" },
      { slug: "70-percent-rule-calculator", title: "70% Rule Calculator", inputs: ["ARV", "repair cost"], formula: "MAO = ARV x 0.70 - repairs" },
      { slug: "rehab-cost-estimator", title: "Rehab Cost Estimator", inputs: ["sq ft", "scope level"], formula: "sum(line items) + 10-15% contingency" },
      { slug: "flip-profit-calculator", title: "Flip Profit Calculator", inputs: ["purchase", "rehab", "holding", "selling costs", "ARV"], formula: "profit = ARV - all costs" },
      { slug: "hard-money-loan-calculator", title: "Hard Money Loan Cost Calculator", inputs: ["loan amount", "rate", "points", "months"], formula: "interest + points + fees" },
      { slug: "brrrr-calculator", title: "BRRRR Calculator", inputs: ["purchase", "rehab", "refi LTV", "rent"], formula: "cash left in deal, cash-on-cash" },
    ],
    guideTopics: [
      "How to estimate ARV without an agent",
      "The 70% rule: when it works and when it breaks",
      "Hard money vs private money for a first flip",
      "Rehab budget line items most flippers forget",
      "Holding costs on a 6-month flip",
      "How to find off-market houses to flip",
      "BRRRR vs flip: which fits your capital",
      "Flip taxes: short-term gains basics (not tax advice)",
    ],
    cityPageTitle: "{city}, {state} House Flipping Market",
    articlesPerMonth: 10,
    states: ["TX", "FL", "GA", "NC", "OH", "AZ", "TN", "IN"],
  },
  {
    id: "generic-content",
    label: "content / tools site",
    match: /./,
    audience: "searchers in the niche",
    calculators: [],
    guideTopics: [],
    cityPageTitle: "{city}, {state}",
    articlesPerMonth: 8,
    states: ["CA", "TX", "FL", "NY"],
  },
];

export function flipPresetFor(niche: string): FlipNichePreset {
  return FLIP_NICHE_PRESETS.find((p) => p.match.test(niche || "")) || FLIP_NICHE_PRESETS[FLIP_NICHE_PRESETS.length - 1];
}

/** Monetization programs from the FlipRadar plan. Status is always apply/pending until Tony is approved. */
export type FlipAffiliateStatus = "apply" | "pending" | "active";
export type FlipAffiliateProgram = {
  slug: string;
  name: string;
  kind: "lender" | "software" | "insurance" | "ads";
  payout: string;
  priority: number;
  homeUrl: string;
  envVar: string;
  status: FlipAffiliateStatus;
  /** Network tracking link (set after approval); deploy it as env <envVar> on the flip site. */
  trackingTemplate?: string;
};

export const FLIP_AFFILIATE_PROGRAMS: FlipAffiliateProgram[] = [
  { slug: "kiavi", name: "Kiavi", kind: "lender", payout: "$1,000 per closed loan", priority: 1, homeUrl: "https://www.kiavi.com/", envVar: "AFFILIATE_KIAVI_URL_TEMPLATE", status: "apply" },
  { slug: "new-silver", name: "New Silver", kind: "lender", payout: "$50 per application + 50 bps", priority: 1, homeUrl: "https://newsilver.com/", envVar: "AFFILIATE_NEW_SILVER_URL_TEMPLATE", status: "apply" },
  { slug: "lima-one", name: "Lima One Capital", kind: "lender", payout: "TO RESEARCH", priority: 1, homeUrl: "https://www.limaone.com/", envVar: "AFFILIATE_LIMA_ONE_URL_TEMPLATE", status: "apply" },
  { slug: "offermarket", name: "OfferMarket", kind: "lender", payout: "TO RESEARCH", priority: 1, homeUrl: "https://www.offermarket.us/", envVar: "AFFILIATE_OFFERMARKET_URL_TEMPLATE", status: "apply" },
  { slug: "dealmachine", name: "DealMachine", kind: "software", payout: "20-50% recurring", priority: 2, homeUrl: "https://www.dealmachine.com/", envVar: "AFFILIATE_DEALMACHINE_URL_TEMPLATE", status: "apply" },
  { slug: "resimpli", name: "REsimpli", kind: "software", payout: "20% lifetime", priority: 2, homeUrl: "https://resimpli.com/", envVar: "AFFILIATE_RESIMPLI_URL_TEMPLATE", status: "apply" },
  { slug: "propstream", name: "PropStream", kind: "software", payout: "TO RESEARCH", priority: 2, homeUrl: "https://www.propstream.com/", envVar: "AFFILIATE_PROPSTREAM_URL_TEMPLATE", status: "apply" },
  { slug: "steadily", name: "Steadily", kind: "insurance", payout: "$20 per lead", priority: 3, homeUrl: "https://www.steadily.com/", envVar: "AFFILIATE_STEADILY_URL_TEMPLATE", status: "apply" },
];

export type AdSlotConfig = {
  network: "adsense" | "journey";
  publisherId: string;
  enabled: boolean;
  slots: { id: string; placement: string; pageTypes: string[] }[];
  upgradeRule: string;
  adsTxt?: string;
  approved?: boolean;
};

export const ADSENSE_ID_PLACEHOLDER = "ca-pub-XXXXXXXXXXXXXXXX";

export const isAdsensePublisherId = (id: string) => /^ca-pub-\d{10,20}$/.test(String(id || "").trim());

/** ads.txt line for an AdSense publisher (f08c47fec0942fa0 is Google's certification authority ID). */
export function adsTxtLine(publisherId: string): string {
  return isAdsensePublisherId(publisherId) ? `google.com, ${publisherId.trim().replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0` : "";
}

/** Ads stay OFF until the site is approved in AdSense, even when a real publisher ID is set. */
export function defaultAdSlots(publisherId = "", approved = false): AdSlotConfig {
  const id = isAdsensePublisherId(publisherId) ? publisherId.trim() : ADSENSE_ID_PLACEHOLDER;
  return {
    network: "adsense",
    publisherId: id,
    approved: Boolean(approved),
    adsTxt: adsTxtLine(id),
    enabled: id !== ADSENSE_ID_PLACEHOLDER && Boolean(approved),
    slots: [
      { id: "in-article-1", placement: "after 2nd H2", pageTypes: ["guide", "city"] },
      { id: "in-article-2", placement: "before conclusion", pageTypes: ["guide"] },
      { id: "calculator-below-result", placement: "below calculator result", pageTypes: ["calculator"] },
      { id: "sidebar-sticky", placement: "desktop sidebar", pageTypes: ["guide", "city"] },
    ],
    upgradeRule: "Switch to Journey by Mediavine at 1,000 Tier-1 sessions in 30 days.",
  };
}
