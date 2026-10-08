import type { BaselineSnapshot } from "./types";

/**
 * Day 0 / case-study baseline picker. Pure (no store access, no value imports) so it can be unit-tested with
 * `node --test scripts/baseline-pick.test.mjs`.
 *
 * The Blobs store holds baselines for every catalog site: the Sitesinc case study plus the internal demos
 * (smith-plumbing, kurtis) and any local-dev crawls. The case study must only ever show a Sitesinc baseline,
 * so when the workspace has no usable latestBaselineId we fall back to the newest *Sitesinc* baseline, never
 * to the newest baseline of any site.
 */

/** Same value as FACTORY_PROJECT_ID in ./types (kept literal so this module stays import-free; the test asserts they match). */
export const CASE_STUDY_SITE_ID = "sitesinc-growth-case-study";

/** Internal demo catalog ids (lib/factory/seo-sites.ts). */
export const DEMO_SITE_IDS: readonly string[] = ["smith-plumbing", "kurtis"];

export type PickableBaseline = Pick<BaselineSnapshot, "id" | "capturedAt" | "origin"> & {
  siteId?: string;
  projectId?: string;
};

function baselineSiteId(snapshot: PickableBaseline): string {
  return (snapshot.siteId || snapshot.projectId || "").trim().toLowerCase();
}

/** Internal demo baseline: a demo catalog site id, or a /demo/ origin (e.g. https://sitesinc.co/demo/kurtis). */
export function isDemoBaseline(snapshot: PickableBaseline): boolean {
  const site = baselineSiteId(snapshot);
  if (DEMO_SITE_IDS.includes(site)) return true;
  const origin = String(snapshot.origin || "");
  try {
    const url = new URL(origin);
    return `${url.pathname.toLowerCase().replace(/\/$/, "")}/`.includes("/demo/");
  } catch {
    return /\/demo(\/|$)/i.test(origin);
  }
}

/** Local-dev origin (localhost, *.localhost, 127.x, ::1, 0.0.0.0). */
export function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      /^127\./.test(host) ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(String(origin || ""));
  }
}

/**
 * Eligible for the *fallback* pick: a Sitesinc case-study baseline (site id sitesinc-growth-case-study, or a
 * legacy row with no site id), not a demo, not a local-dev crawl.
 */
export function isCaseStudyBaseline(snapshot: PickableBaseline): boolean {
  if (isDemoBaseline(snapshot) || isLocalOrigin(snapshot.origin)) return false;
  const site = baselineSiteId(snapshot);
  return site === "" || site === CASE_STUDY_SITE_ID;
}

/** Newest Sitesinc case-study baseline in a list (any order), or null. */
export function newestCaseStudyBaseline<T extends PickableBaseline>(baselines: readonly T[]): T | null {
  let best: T | null = null;
  for (const row of baselines) {
    if (!row || !isCaseStudyBaseline(row)) continue;
    if (!best || String(row.capturedAt).localeCompare(String(best.capturedAt)) > 0) best = row;
  }
  return best;
}

/**
 * Pick the baseline for /case-study, /app/case-study, /app/baseline and the /app dashboard:
 *   1. workspace.latestBaselineId, when it resolves and is not a demo baseline (an operator's explicit pick,
 *      including a local-dev capture);
 *   2. workspace.latestBaselineBySite[sitesinc-growth-case-study], same rule;
 *   3. otherwise the newest Sitesinc case-study baseline. Never a demo (Smith / Kurtis) or localhost crawl.
 */
export async function pickCaseStudyBaseline<T extends PickableBaseline>(deps: {
  latestBaselineId?: string;
  latestBaselineBySite?: Record<string, string>;
  read: (id: string) => Promise<T | null>;
  list: () => Promise<T[]>;
}): Promise<T | null> {
  const tried = new Set<string>();
  for (const id of [deps.latestBaselineId, deps.latestBaselineBySite?.[CASE_STUDY_SITE_ID]]) {
    if (!id || tried.has(id)) continue;
    tried.add(id);
    const named = await deps.read(id);
    if (named && !isDemoBaseline(named)) return named;
  }
  return newestCaseStudyBaseline(await deps.list());
}
