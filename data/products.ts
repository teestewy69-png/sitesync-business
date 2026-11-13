/**
 * Paused SiteFlow catalog (phase 2). Not a public shop: Sitesinc sells website builds and optional monitoring only.
 *
 * Rules (see docs/siteflow.md):
 *  - `listed: false` hides an entry from any future product page and from the (paused) cart/checkout.
 *  - `priceCents` stays undefined until Tony sets a price. An unpriced entry can never be checked out
 *    and is never pushed to Stripe.
 *  - `stripeLookupKey` is how scripts/siteflow/stripe-sync.mjs finds (or creates) the Stripe price and how
 *    checkout resolves a real Stripe price id. Changing a price = change `priceCents`, re-run the sync.
 *  - `deliverable` says what the buyer receives: a private Blobs file key, a generator id, or nothing
 *    (manual service). No strike-through "regular" prices: show only the real price.
 *
 * 2026-10-05: SiteFlow is paused (lib/siteflow/flag.ts, SITEFLOW_ENABLED off by default) and the public shop
 * (/shop, product pages, inquiry form, /api/products) was removed; /shop and /shop/* 301 to /. Nothing here is
 * shown to visitors or purchasable while paused, whatever `listed`/`priceCents` say. The drafts below are kept
 * for phase 2. The retired bundle and the old contact-only shop items were removed entirely, images included.
 *
 * This file has no imports on purpose: the Stripe sync script loads it directly with Node.
 */

export type ProductKind = "digital" | "subscription" | "service" | "affiliate_out";

export type DeliverableGenerator = "domainiq-report" | "seo-audit";

export type Deliverable =
  /** Static file kept in the private deliverables Blobs store (never public). */
  | { type: "file"; fileKey: string; filename: string }
  /** Generated per order by an adapter (lib/siteflow/generators). */
  | { type: "generator"; generator: DeliverableGenerator; filename: string }
  /** Nothing to download: Tony onboards / performs the service by hand. */
  | { type: "manual"; note: string };

/** Extra input a buyer must give at checkout so a generated deliverable can be produced. */
export type FulfillmentInput = {
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  kind: "text" | "url";
  maxLength: number;
};

export type CatalogEntry = {
  slug: string;
  name: string;
  category: string;
  kind: ProductKind;
  description: string;
  /** Public only when true. Drafts and retired entries stay false. */
  listed: boolean;
  /** Retired entries are kept for order history only: never listed, never synced, never sold. */
  retired?: boolean;
  /** Price in US cents. Undefined until Tony sets it. */
  priceCents?: number;
  /** Subscriptions only. */
  interval?: "month" | "year";
  /** Subscriptions only: free trial days before the first charge ("1st month free"). */
  trialDays?: number;
  /** Billing disclosure shown on the cart, checkout and Stripe Checkout page. */
  disclosure?: string;
  /** Stripe price lookup key (stable; the sync script and checkout use it). */
  stripeLookupKey?: string;
  deliverable?: Deliverable;
  fulfillmentInputs?: FulfillmentInput[];
  /** Inquiry-only: no price, no cart, quote by email. */
  contactOnly?: boolean;
  /** Physical goods ship, so checkout must collect a postal address. Digital/service never does. */
  requiresShipping?: boolean;
  /** affiliate_out only: registry slug in lib/affiliates.ts (sent through /go/[slug]). */
  affiliateSlug?: string;
  badge?: string;
  image: string;
};

/** Derived shape used by the paused cart/checkout UI. `price` is display text derived from `priceCents`. */
export type Product = CatalogEntry & { price?: string };

export const MONITORING_DISCLOSURE =
  "1st month free. Your card is charged $129/mo starting on day 31 unless you cancel before then.";

export const catalog: CatalogEntry[] = [
  // --- Planned SiteFlow products (phase 2, paused): unlisted drafts, never public while paused -----
  {
    slug: "keep-it-earning-kit",
    name: "Keep-it-earning kit",
    category: "Digital Products",
    kind: "digital",
    listed: false,
    stripeLookupKey: "sitesinc_keep_it_earning_kit",
    deliverable: {
      type: "file",
      fileKey: "kits/keep-it-earning-kit.zip",
      filename: "sitesinc-keep-it-earning-kit.zip",
    },
    description:
      "Offer-page templates, an update cadence, and SEO refresh prompts from Sitesinc client builds.",
    image: "/logo.png",
  },
  {
    slug: "website-monitoring",
    name: "Website monitoring",
    category: "Subscriptions",
    kind: "subscription",
    // Public: the only priced product. Matches the public offer: 1st month free, then $129/mo.
    listed: true,
    priceCents: 12900,
    interval: "month",
    trialDays: 30,
    disclosure: MONITORING_DISCLOSURE,
    stripeLookupKey: "sitesinc_monitoring_monthly",
    deliverable: {
      type: "manual",
      note: "Tony enrolls the site in monitoring by hand after payment.",
    },
    fulfillmentInputs: [
      { key: "siteUrl", label: "Website to monitor", placeholder: "https://example.com", required: true, kind: "url", maxLength: 200 },
    ],
    description:
      "Optional monitored SEO: 1st month free, then $129/mo. Uptime checks, basic technical updates, and two to three small text or image changes a month. Cancel anytime.",
    image: "/logo.png",
  },
  {
    slug: "domainiq-domain-report",
    name: "DomainIQ domain report",
    category: "Reports",
    kind: "digital",
    listed: false,
    priceCents: 40000,
    stripeLookupKey: "sitesinc_domainiq_report",
    deliverable: { type: "generator", generator: "domainiq-report", filename: "domainiq-domain-report.html" },
    fulfillmentInputs: [
      { key: "businessName", label: "Business name", required: true, kind: "text", maxLength: 120 },
      { key: "niche", label: "What the business does", placeholder: "e.g. plumbing", required: true, kind: "text", maxLength: 80 },
      { key: "city", label: "City", required: true, kind: "text", maxLength: 80 },
      { key: "state", label: "State", placeholder: "e.g. TX", required: true, kind: "text", maxLength: 40 },
    ],
    description:
      "Scored domain-name ideas for your business and city from the DomainIQ engine, with an availability check where the registry allows it.",
    image: "/logo.png",
  },
  {
    slug: "local-seo-audit-report",
    name: "Local SEO audit report",
    category: "Reports",
    kind: "digital",
    listed: false,
    stripeLookupKey: "sitesinc_local_seo_audit",
    deliverable: { type: "generator", generator: "seo-audit", filename: "local-seo-audit.html" },
    fulfillmentInputs: [
      { key: "siteUrl", label: "Website to audit", placeholder: "https://example.com", required: true, kind: "url", maxLength: 200 },
    ],
    description:
      "An on-page crawl of up to 100 pages of your site: titles, descriptions, headings, canonicals, image alt text, and contact paths, with plain-language fixes.",
    image: "/logo.png",
  },
  {
    slug: "website-template-pack",
    name: "Website template pack",
    category: "Digital Products",
    kind: "digital",
    listed: false,
    stripeLookupKey: "sitesinc_website_template_pack",
    deliverable: {
      type: "file",
      fileKey: "kits/website-template-pack.zip",
      filename: "sitesinc-website-template-pack.zip",
    },
    description: "Small-business website page templates from the Sitesinc factory.",
    image: "/logo.png",
  },
  // --- Test Lane guides (produced 2026-11-10): priced, parked unlisted until Tony lists them -----
  {
    slug: "midlife-weight-reset",
    name: "The Midlife Weight Reset",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 2400,
    stripeLookupKey: "sitesinc_midlife_weight_reset",
    deliverable: {
      type: "file",
      fileKey: "ebooks/midlife-weight-reset.pdf",
      filename: "midlife-weight-reset.pdf",
    },
    description:
      "A menopause weight and muscle guide for women 50+: protein-first eating, beginner strength training at home, daily movement and sleep basics, with weekly trackers. Educational only — no promised results.",
    image: "/logo.png",
  },
  {
    slug: "first-cruise-after-60",
    name: "First Cruise After 60",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 1900,
    stripeLookupKey: "sitesinc_first_cruise_after_60",
    deliverable: {
      type: "file",
      fileKey: "ebooks/first-cruise-after-60.pdf",
      filename: "first-cruise-after-60.pdf",
    },
    description:
      "A first-time cruiser planning guide for travelers 60+: choosing a ship and cabin, the real budget with a fill-in worksheet, travel insurance, health prep, packing and countdown checklists. Prices in the guide are illustrative ranges.",
    image: "/logo.png",
  },
  {
    slug: "strong-bones-after-50",
    name: "Strong Bones After 50",
    category: "Digital Products",
    kind: "digital",
    listed: false,
    priceCents: 2900,
    stripeLookupKey: "sitesinc_strong_bones_after_50",
    deliverable: {
      type: "file",
      fileKey: "ebooks/strong-bones-after-50.pdf",
      filename: "strong-bones-after-50.pdf",
    },
    description:
      "A 12-week progressive strength program for women over 50, built around bone-health principles, with safety guidance, nutrition basics and tracking sheets. Educational only; clinician review pending before sale.",
    image: "/logo.png",
  },
  {
    slug: "hearing-aids-honestly",
    name: "Hearing Aids, Honestly",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 1900,
    stripeLookupKey: "sitesinc_hearing_aids_honestly",
    deliverable: {
      type: "file",
      fileKey: "ebooks/hearing-aids-honestly.pdf",
      filename: "hearing-aids-honestly.pdf",
    },
    description:
      "An OTC hearing aid buyer's guide for 60+: get an exam first, understand the specs in plain English, follow a step-by-step shopping framework, and use the scam filter before you spend. Educational only — no device picks, no medical advice.",
    image: "/logo.png",
  },
  {
    slug: "sleep-after-60",
    name: "Sleep After 60",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 1900,
    stripeLookupKey: "sitesinc_sleep_after_60",
    deliverable: {
      type: "file",
      fileKey: "ebooks/sleep-after-60.pdf",
      filename: "sleep-after-60.pdf",
    },
    description:
      "A drug-free sleep restoration guide for 50+: how sleep changes with age, the warning signs that need a doctor, CBT-I principles explained plainly, and a gentle 4-week reset plan with sleep-diary worksheets. Educational only — not a treatment or cure.",
    image: "/logo.png",
  },
  {
    slug: "padel-after-50",
    name: "Padel After 50",
    category: "Digital Products",
    kind: "digital",
    listed: false,
    priceCents: 2400,
    stripeLookupKey: "sitesinc_padel_after_50",
    deliverable: {
      type: "file",
      fileKey: "ebooks/padel-after-50.pdf",
      filename: "padel-after-50.pdf",
    },
    description:
      "A beginner's starter guide to padel for adults 50+: rules and wall play, gear, finding a court and clinic, your first session step by step, and a gentle 6-week starter plan. Educational only; expert review pending before sale.",
    image: "/logo.png",
  },
  {
    slug: "empty-nest-kitchen",
    name: "The Empty-Nest Kitchen",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 1900,
    stripeLookupKey: "sitesinc_empty_nest_kitchen",
    deliverable: {
      type: "file",
      fileKey: "ebooks/empty-nest-kitchen.pdf",
      filename: "empty-nest-kitchen.pdf",
    },
    description:
      "Cooking for one or two after 50: the right-sized pantry, scaling any recipe down, cook-once-eat-twice without a week of leftovers, and 19 complete recipes written for 1–2 servings, with planning worksheets.",
    image: "/logo.png",
  },
  {
    slug: "digital-afterlife",
    name: "Your Digital Afterlife",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 1900,
    stripeLookupKey: "sitesinc_digital_afterlife",
    deliverable: {
      type: "file",
      fileKey: "ebooks/digital-afterlife.pdf",
      filename: "digital-afterlife.pdf",
    },
    description:
      "A digital legacy and passwords organizer for 50+: inventory your accounts, set up a password manager as the single key, use Apple/Google/Facebook legacy tools, and leave your family a first-48-hours map. General information only — not legal advice.",
    image: "/logo.png",
  },
  {
    slug: "caregivers-playbook",
    name: "The Caregiver's Playbook",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 2900,
    stripeLookupKey: "sitesinc_caregivers_playbook",
    deliverable: {
      type: "file",
      fileKey: "ebooks/caregivers-playbook.pdf",
      filename: "caregivers-playbook.pdf",
    },
    description:
      "The first 90 days caring for an aging parent, as a system: stabilize week one, the paperwork and money maps, the family meeting with scripts, and five fill-in worksheets including a cost tracker. General information only — not legal, medical, or financial advice.",
    image: "/logo.png",
  },
  {
    slug: "skip-gen-adventures",
    name: "Skip-Gen Adventures",
    category: "Digital Products",
    kind: "digital",
    listed: true,
    priceCents: 2400,
    stripeLookupKey: "sitesinc_skip_gen_adventures",
    deliverable: {
      type: "file",
      fileKey: "ebooks/skip-gen-adventures.pdf",
      filename: "skip-gen-adventures.pdf",
    },
    description:
      "A grandparent-and-grandchild trip planning guide: trips by age band, the consent-letter template and paperwork, a three-budget splitter, pace rules for two body clocks, and planner worksheets. Prices are illustrative ranges; check current rules before you book.",
    image: "/logo.png",
  },
];

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** "$129.00/mo" for subscriptions, "$49.00" for one-off, undefined while unpriced. */
export function displayPrice(entry: CatalogEntry): string | undefined {
  if (typeof entry.priceCents !== "number") return undefined;
  const base = formatCents(entry.priceCents);
  if (entry.kind === "subscription") {
    const per = `${base}/${entry.interval === "year" ? "yr" : "mo"}`;
    return entry.trialDays === 30 && entry.interval !== "year" ? `1st month free, then ${per}` : entry.trialDays ? `${entry.trialDays} days free, then ${per}` : per;
  }
  return base;
}

function toProduct(entry: CatalogEntry): Product {
  return { ...entry, price: displayPrice(entry) };
}

/** Every entry (including drafts and retired), with display prices. Internal use only. */
export const products: Product[] = catalog.map(toProduct);

/** Prefer explicit `image` as the source of truth (JPG when present). */
export function getProductImageSrc(product: Product): string {
  return product.image;
}

/** SVG placeholder under public/products/{slug}.svg when the JPG is missing. */
export function getProductImageFallbackSrc(product: Product): string {
  return `/products/${product.slug}.svg`;
}

/** Public = listed, not retired, and either inquiry-only or actually priced (a listed entry without a price stays hidden). */
export function isListedProduct(product: CatalogEntry): boolean {
  if (product.listed !== true || product.retired) return false;
  if (product.kind === "affiliate_out") return false;
  return Boolean(product.contactOnly) || (typeof product.priceCents === "number" && product.priceCents > 0);
}

/** Can this entry be put in a cart and paid for right now? */
export function isPurchasable(product: CatalogEntry): boolean {
  return (
    isListedProduct(product) &&
    !product.contactOnly &&
    product.kind !== "affiliate_out" &&
    typeof product.priceCents === "number" &&
    product.priceCents > 0
  );
}

export function getPublicProducts(): Product[] {
  return products.filter(isListedProduct);
}

/** Public lookup: unlisted, draft and retired entries do not exist for visitors. */
export function getProduct(slug: string): Product | undefined {
  const product = products.find((p) => p.slug === slug);
  if (!product || !isListedProduct(product)) return undefined;
  return product;
}

/** Internal lookup (orders, fulfillment, the factory bay): includes unlisted entries. */
export function getCatalogEntry(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/** Recurring/one-off unit price in dollars (from priceCents, never from display text). */
export function unitPrice(product: CatalogEntry): number {
  return typeof product.priceCents === "number" ? product.priceCents / 100 : 0;
}

/** Amount charged today: 0 for subscriptions still in their free trial. */
export function dueToday(product: CatalogEntry): number {
  if (product.kind === "subscription" && product.trialDays) return 0;
  return unitPrice(product);
}

/** Parse "$24.99" → 24.99. Returns 0 for contact-only / missing prices. */
export function parsePrice(price?: string): number {
  if (!price) return 0;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
