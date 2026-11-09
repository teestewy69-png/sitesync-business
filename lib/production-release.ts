/**
 * Baked public production-release metadata.
 *
 * The JSON in lib/generated/production-release.json is a committed stub
 * (`present: false`). Netlify production builds overwrite it from COMMIT_REF
 * before `next build` (see scripts/factory-sync/write-production-release-manifest.mjs).
 * The route at /release.json reads this snapshot, never process.env at request time.
 */
import baked from "@/lib/generated/production-release.json";

export const PRODUCTION_RELEASE_SCHEMA = "sitesinc-production-release/v1";
export const PRODUCTION_RELEASE_SITE = "sitesinc.co";
export const PRODUCTION_COMMIT_RE = /^[0-9a-f]{40}$/;

export type PublicProductionRelease = {
  schema: typeof PRODUCTION_RELEASE_SCHEMA;
  present: true;
  commit: string;
  context: "production";
  site: typeof PRODUCTION_RELEASE_SITE;
  publishedAt?: string;
};

type Baked = {
  schema?: unknown;
  present?: unknown;
  commit?: unknown;
  context?: unknown;
  site?: unknown;
  publishedAt?: unknown;
};

/** Allowlisted public fields only. Extra keys in the baked file are dropped. */
export function getBakedProductionRelease(): PublicProductionRelease | null {
  const data = baked as Baked;
  if (!data || data.present !== true) return null;
  if (data.schema !== PRODUCTION_RELEASE_SCHEMA) return null;
  if (data.context !== "production") return null;
  if (data.site !== PRODUCTION_RELEASE_SITE) return null;
  const commit = String(data.commit || "").trim().toLowerCase();
  if (!PRODUCTION_COMMIT_RE.test(commit)) return null;
  const publishedAt = typeof data.publishedAt === "string" && data.publishedAt.trim() ? data.publishedAt.trim() : undefined;
  return {
    schema: PRODUCTION_RELEASE_SCHEMA,
    present: true,
    commit,
    context: "production",
    site: PRODUCTION_RELEASE_SITE,
    ...(publishedAt ? { publishedAt } : {}),
  };
}
