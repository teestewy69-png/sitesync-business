/**
 * SiteFlow master switch. Path A (Tony, 2026-10-05): the public offer is ONLY the website build (from $1,995,
 * 50% to start / 50% at launch) and optional $129/mo monitoring. SiteFlow (product checkout, Stripe webhook,
 * digital delivery, partner referrals, affiliate links) is paused for phase 2. The code stays; this flag keeps
 * it off and invisible unless SITEFLOW_ENABLED is exactly "true" or "1".
 *
 * No imports on purpose: middleware (edge), route handlers, server components and node tests all use it.
 */

export const SITEFLOW_PAUSED_LABEL = "Paused (phase 2)";

type Env = Record<string, string | undefined>;

export function siteflowEnabled(env: Env = process.env): boolean {
  const value = (env.SITEFLOW_ENABLED || "").trim().toLowerCase();
  return value === "true" || value === "1";
}

/**
 * Routes that only exist for SiteFlow. While paused they answer 404 (middleware and each route check this).
 * /thank-you is NOT here: it stays for build requests, it only stops showing order/payment states.
 */
const SITEFLOW_PREFIXES = ["/go/", "/api/download/", "/api/siteflow/", "/api/factory/siteflow/"];
const SITEFLOW_EXACT = new Set([
  "/go",
  "/tools",
  "/cart",
  "/checkout",
  "/api/checkout",
  "/api/stripe/webhook",
  "/api/factory/siteflow",
  "/api/siteflow",
  "/api/download",
]);

export function isSiteflowPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (SITEFLOW_EXACT.has(path)) return true;
  return SITEFLOW_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Plain 404 for a paused SiteFlow route. Says nothing about SiteFlow to the public. */
export function siteflowPausedResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
