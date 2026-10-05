/**
 * Tiny GA4 helper. Every function is a safe no-op unless gtag was loaded by
 * components/Analytics.tsx (production host only, see docs/analytics.md).
 * Never pass PII (email, phone, name, free-text messages) in params.
 */

type GtagParams = Record<string, string | number | boolean | undefined | unknown[]>;
type Gtag = (command: string, target: string | Date, params?: GtagParams) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Routes that never send analytics: client previews and the factory admin. */
const EXCLUDED_PATH_PREFIXES = ["/demo/client", "/app", "/api"];

export function isExcludedAnalyticsPath(pathname: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAllowedAnalyticsHost(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.includes(hostname.toLowerCase());
}

function currentPath(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

/** Send a GA4 event. Never throws; does nothing when gtag is missing or blocked. */
export function trackEvent(name: string, params: GtagParams = {}): void {
  try {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    const pagePath = currentPath();
    if (isExcludedAnalyticsPath(pagePath)) return;
    window.gtag("event", name, { page_path: pagePath, ...params });
  } catch {
    // Analytics must never break the page.
  }
}

/** Fire only after a lead form was saved successfully. */
export function trackLead(formName: string, params: GtagParams = {}): void {
  trackEvent("generate_lead", { form_name: formName, ...params });
}

/** Main CTA clicks. */
export function trackCtaClick(ctaName: string, params: GtagParams = {}): void {
  trackEvent("click", { cta_name: ctaName, ...params });
}

export type AnalyticsItem = {
  item_id: string;
  item_name?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

export function trackSelectItem(listName: string, item: AnalyticsItem): void {
  trackEvent("select_item", { item_list_name: listName, items: [item] });
}

export function trackAddToCart(item: AnalyticsItem): void {
  trackEvent("add_to_cart", {
    currency: "USD",
    value: (item.price ?? 0) * (item.quantity ?? 1),
    items: [item],
  });
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number): void {
  trackEvent("begin_checkout", { currency: "USD", value, items });
}
