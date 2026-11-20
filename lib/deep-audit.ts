import { auditIssues, crawlSite, healthScore, publishedPhones, siteNap } from "@/lib/siteflow/generators/seo-audit";

/**
 * The deep half of the free website audit: the same engine SiteFlow runs for the paid Local SEO
 * Audit Report, pointed at one public site on a short clock. Crawls up to 10 pages, scores the
 * site 0-100, and returns the findings grouped so a page repeated on five pages reads once,
 * with a page count. Read-only; stores nothing.
 */

export type DeepFinding = {
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
  /** How many crawled pages this finding appeared on (site-level findings count as 1). */
  pages: number;
  firstPage: string;
};

export type DeepAuditResult =
  | {
      ok: true;
      checkedUrl: string;
      finalUrl: string;
      checkedAt: string;
      pagesCrawled: number;
      score: number;
      counts: { high: number; medium: number; low: number };
      findings: DeepFinding[];
      /** Phone numbers the site publishes as its own (quoted third-party numbers excluded). */
      phones: string[];
      /** Distinct street addresses the site publishes. */
      addresses: string[];
    }
  | { ok: false; error: string };

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** Public-route crawl limits: deep enough to hurt, short enough for a web request. */
export const DEEP_AUDIT_MAX_PAGES = 10;
export const DEEP_AUDIT_BUDGET_MS = 25_000;
export const DEEP_AUDIT_MAX_FINDINGS = 10;

export async function deepAuditUrl(rawUrl: string): Promise<DeepAuditResult> {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter your website address, like joesplumbing.com." };
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let crawl;
  try {
    crawl = await crawlSite(candidate, { maxPages: DEEP_AUDIT_MAX_PAGES, budgetMs: DEEP_AUDIT_BUDGET_MS });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The deep audit could not run on that address." };
  }

  const issues = auditIssues(crawl);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) counts[issue.severity] += 1;

  const grouped = new Map<string, DeepFinding>();
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.issue}`;
    const existing = grouped.get(key);
    if (existing) existing.pages += 1;
    else grouped.set(key, { severity: issue.severity, issue: issue.issue, fix: issue.fix, pages: 1, firstPage: issue.page });
  }
  const findings = [...grouped.values()]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.pages - a.pages)
    .slice(0, DEEP_AUDIT_MAX_FINDINGS);

  const nap = siteNap(crawl);
  return {
    ok: true,
    checkedUrl: candidate,
    finalUrl: crawl.origin,
    checkedAt: new Date().toISOString(),
    pagesCrawled: crawl.pages.length,
    score: healthScore(issues),
    counts,
    findings,
    phones: publishedPhones(nap).map((p) => p.display),
    addresses: nap.addresses.map((a) => a.display),
  };
}
