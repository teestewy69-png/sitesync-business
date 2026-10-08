/**
 * Staging isolation flag. Production is the default when this is unset.
 *
 * Set NEXT_PUBLIC_SITE_ENV=staging (preferred) or SITE_ENV=staging on the
 * staging Netlify site only. Do not set either on the production site.
 *
 * Do not infer staging from CONTEXT / URL: the staging copy is a separate
 * Netlify site whose production deploys report CONTEXT=production.
 */
export type SiteEnv = "staging" | "production";

function envFlag(name: string): string {
  return (process.env[name] || "").trim().toLowerCase();
}

export function siteEnv(): SiteEnv {
  const value = envFlag("NEXT_PUBLIC_SITE_ENV") || envFlag("SITE_ENV");
  return value === "staging" ? "staging" : "production";
}

export function isStagingEnv(): boolean {
  return siteEnv() === "staging";
}

// Kept here, not in lib/analytics.ts: next.config.ts imports this file and the
// config loader cannot resolve its imports, so keep this file dependency-free.
/** Default production GA4 property (sitesinc.co web stream). */
export const DEFAULT_GA_MEASUREMENT_ID = "G-0XHXXSSB1N";
/** Hosts that may send to the production property. */
export const PRODUCTION_ANALYTICS_HOSTS = ["sitesinc.co", "www.sitesinc.co"];
/** Hosts that may send to the optional staging-only property. */
export const STAGING_ANALYTICS_HOSTS = ["test.sitesinc.co"];

export function publicAnalyticsMeasurementId(): string {
  if (isStagingEnv()) {
    return (process.env.NEXT_PUBLIC_GA_STAGING_MEASUREMENT_ID || "").trim();
  }
  // Production default. It only loads on sitesinc.co / www.sitesinc.co
  // (see publicAnalyticsHosts and components/Analytics.tsx), so localhost,
  // deploy previews and *.netlify.app never send to it.
  return (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim() || DEFAULT_GA_MEASUREMENT_ID;
}

/** Hostnames allowed to load the measurement ID above. */
export function publicAnalyticsHosts(): string[] {
  return isStagingEnv() ? STAGING_ANALYTICS_HOSTS : PRODUCTION_ANALYTICS_HOSTS;
}

export function stagingMailSubject(subject: string): string {
  if (!isStagingEnv()) return subject;
  return subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`;
}

export function stagingMailBody(text: string): string {
  if (!isStagingEnv()) return text;
  return `${text}\n\nThis message was sent from the Sitesinc staging site (test.sitesinc.co), not production.`;
}
