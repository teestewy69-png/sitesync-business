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

export function publicAnalyticsMeasurementId(): string {
  if (isStagingEnv()) {
    return process.env.NEXT_PUBLIC_GA_STAGING_MEASUREMENT_ID || "";
  }
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
}

export function stagingMailSubject(subject: string): string {
  if (!isStagingEnv()) return subject;
  return subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`;
}

export function stagingMailBody(text: string): string {
  if (!isStagingEnv()) return text;
  return `${text}\n\nThis message was sent from the Sitesinc staging site (test.sitesinc.co), not production.`;
}
