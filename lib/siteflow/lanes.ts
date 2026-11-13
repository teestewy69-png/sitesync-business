/**
 * Store lanes: the audience groupings behind the lane pages (/store/lane/[lane])
 * and the "More in <lane>" footer on per-product landing pages (/store/[slug]).
 * The lane slug lives on the catalog entry (`lane` in data/products.ts); this map
 * is the single place that turns a slug into a display name and, for one lane,
 * its bundle offer. Plain data, no imports: pages, components and node tests
 * all load it directly.
 */

export type LaneBundle = {
  name: string;
  /** Display price text, e.g. "$39". */
  price: string;
  note: string;
  gumroadUrl: string;
};

export type Lane = {
  slug: string;
  name: string;
  bundle?: LaneBundle;
};

export const LANES: Record<string, Lane> = {
  "women-50": {
    slug: "women-50",
    name: "Women 50+",
  },
  "family-sandwich": {
    slug: "family-sandwich",
    name: "Family & the Sandwich Generation",
    bundle: {
      name: "The Family Papers Bundle",
      price: "$39",
      note: "The Caregiver's Playbook + Your Digital Afterlife together ($48 separately)",
      gumroadUrl: "https://40sinc.gumroad.com/l/zhtxog",
    },
  },
  "travel-60": {
    slug: "travel-60",
    name: "Travel After 60",
  },
  "home-daily": {
    slug: "home-daily",
    name: "Home & Daily Life",
  },
};

/** Lane lookup by slug; undefined for missing/unknown slugs (callers 404 or skip). */
export function getLane(slug: string | undefined): Lane | undefined {
  if (!slug) return undefined;
  return LANES[slug];
}
