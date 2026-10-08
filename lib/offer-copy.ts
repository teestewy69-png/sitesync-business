/**
 * Path A offer guard (Tony, 2026-10-05). The public offer is ONLY:
 *   - website builds are $1,995 (flat fee), paid 50% to start and 50% at launch (invoiced by hand)
 *   - optional monitoring at $129/month
 * Public copy must not promise digital-product delivery, Stripe checkout, affiliate or monetization
 * placeholders, discounts/strike-through prices, scarcity, or "pay in full". scripts/offer-copy.test.mjs scans
 * the public sources with these patterns, and published factory pages are checked at render time.
 */

export const PATH_A_OFFER = {
  buildFrom: "$1,995",
  startDue: "$997.50",
  launchDue: "$997.50",
  monitoring: "$129/month",
} as const;

export const RETIRED_OFFER_PATTERNS: RegExp[] = [
  /monetization[ -](placeholders?|ready|setup|planned)/i,
  /money[ -](ready|making pieces|pieces)/i,
  /stripe[ -](integration|ready|slot|payments?\b|if you sell|when you need|checkout)/i,
  /live stripe checkout/i,
  /checkout (placeholders?|ready)/i,
  /digital[ -]products?/i,
  /digital download/i,
  /affiliate (links?|areas?|placeholders?)/i,
  /pay(ment)? in full/i,
  /limited[ -](offer|time|launch)/i,
  /\bspots? remain/i,
  /line-through/i,
  /keep-it-earning/i,
  /niche playbooks?/i,
  /check your email for (your )?(delivery|download)/i,
  /payment successful/i,
  /start(ing)? at \$/i,
  /from \$1,?995/i,
  /\bstarting price\b/i,
  /\bno quotes\b/i,
  /\b(get|request|ask for) (a )?quote\b/i,
  /\bfree quotes?\b/i,
];

/** The first retired-offer phrase found in `text`, or null. */
export function findRetiredOfferClaim(text: string): string | null {
  for (const pattern of RETIRED_OFFER_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}
