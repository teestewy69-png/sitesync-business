/**
 * SiteFlow catalog: the single source of truth for everything Sitesinc sells or links out to.
 *
 * Rules (see docs/siteflow.md):
 *  - `listed: false` hides an entry everywhere public: /shop, product pages, the cart and /api/products.
 *  - `priceCents` stays undefined until Tony sets a price. An unpriced entry can never be checked out
 *    and is never pushed to Stripe.
 *  - `stripeLookupKey` is how scripts/siteflow/stripe-sync.mjs finds (or creates) the Stripe price and how
 *    checkout resolves a real Stripe price id. Changing a price = change `priceCents`, re-run the sync.
 *  - `deliverable` says what the buyer receives: a private Blobs file key, a generator id, or nothing
 *    (manual service). No strike-through "regular" prices: show only the real price.
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

/** Public/derived shape used by the shop UI. `price` is display text derived from `priceCents`. */
export type Product = CatalogEntry & { price?: string };

export const catalog: CatalogEntry[] = [
  // --- Contact-only (listed) -------------------------------------------------------------------
  {
    slug: "financial-consulting",
    name: "Financial Consultation",
    category: "Consulting",
    kind: "service",
    listed: true,
    contactOnly: true,
    description:
      "Professional financial consultation services. Contact us directly for pricing and service details.",
    image: "/products/financial-consulting.jpg",
  },
  {
    slug: "gold-filled-jewelry",
    name: "24k, 18k & 14k Gold Filled Jewelry",
    category: "Jewelry",
    kind: "service",
    listed: true,
    contactOnly: true,
    requiresShipping: true,
    description:
      "Gold-filled jewelry from our affiliate sources. Contact us for pricing, availability, and inventory.",
    image: "/products/gold-filled-jewelry.jpg",
  },

  // --- Planned SiteFlow products: unlisted drafts until Tony sets prices and lists them ----------
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
    image: "/products/website-design-bundle.jpg",
  },
  {
    slug: "website-monitoring",
    name: "Website monitoring",
    category: "Subscriptions",
    kind: "subscription",
    listed: false,
    // $129/month is already the public monitoring price (content.json).
    priceCents: 12900,
    interval: "month",
    stripeLookupKey: "sitesinc_monitoring_monthly",
    deliverable: {
      type: "manual",
      note: "Tony enrolls the site in monitoring by hand after payment.",
    },
    fulfillmentInputs: [
      { key: "siteUrl", label: "Website to monitor", placeholder: "https://example.com", required: true, kind: "url", maxLength: 200 },
    ],
    description:
      "Optional monitoring: uptime checks, basic technical updates, and two to three small text or image changes a month. Cancel anytime.",
    image: "/products/website-design-bundle.jpg",
  },
  {
    slug: "domainiq-domain-report",
    name: "DomainIQ domain report",
    category: "Reports",
    kind: "digital",
    listed: false,
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
    image: "/products/website-design-bundle.jpg",
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
      "An on-page crawl of up to 15 pages of your site: titles, descriptions, headings, canonicals, image alt text, and contact paths, with plain-language fixes.",
    image: "/products/website-design-bundle.jpg",
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
    image: "/products/website-design-bundle.jpg",
  },

  // --- Retired: kept for order history only -------------------------------------------------------
  {
    slug: "website-design-digital-bundle",
    name: "Website Design Digital Product Bundle",
    category: "Digital Products",
    kind: "digital",
    listed: false,
    retired: true,
    description: "Retired. This old website-design bundle is not a public Sitesinc offer.",
    image: "/products/website-design-bundle.jpg",
  },
];

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** "$129.00/mo" for subscriptions, "$49.00" for one-off, undefined while unpriced. */
export function displayPrice(entry: CatalogEntry): string | undefined {
  if (typeof entry.priceCents !== "number") return undefined;
  const base = formatCents(entry.priceCents);
  if (entry.kind === "subscription") return `${base}/${entry.interval === "year" ? "yr" : "mo"}`;
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

export function isListedProduct(product: CatalogEntry): boolean {
  return product.listed === true && !product.retired;
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
