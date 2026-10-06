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

/** Routes that never send analytics: all demo sites/client previews, factory admin, API. */
const EXCLUDED_PATH_PREFIXES = ["/demo", "/app", "/api"];

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

/**
 * Non-commerce content choice, e.g. the homepage design style picker.
 * Sitesinc has no shop: there are deliberately no select_item / add_to_cart / begin_checkout helpers.
 */
export function trackSelectContent(contentType: string, contentId: string): void {
  trackEvent("select_content", { content_type: contentType, content_id: contentId });
}
