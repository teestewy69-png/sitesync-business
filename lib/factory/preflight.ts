import type {
  BaselineSnapshot,
  ConversionCheck,
  FactoryPage,
  FactoryWorkspace,
} from "./types";

export type PreflightItem = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "in_progress";
  detail: string;
};

export function buildPreflight(
  workspace: FactoryWorkspace,
  baseline: BaselineSnapshot | null
): PreflightItem[] {
  const pages = baseline?.pageInventory || [];
  const staged = workspace.pages.filter((p) => p.status === "staged" || p.status === "published");
  const items: PreflightItem[] = [];

  const missingTitle = pages.filter((p) => p.statusCode === 200 && !p.title);
  items.push({
    id: "titles",
    label: "Titles / meta",
    status: missingTitle.length ? "fail" : pages.length ? "pass" : "in_progress",
    detail: missingTitle.length
      ? `Missing title: ${missingTitle.map((p) => p.path).join(", ")}`
      : `${pages.filter((p) => p.metaDescription).length}/${pages.length} live pages have a meta description.`,
  });

  const missingH1 = pages.filter((p) => p.statusCode === 200 && p.headings.h1.length !== 1);
  items.push({
    id: "headings",
    label: "Headings",
    status: missingH1.length ? "warn" : "pass",
    detail: missingH1.length
      ? `Pages without exactly one H1: ${missingH1.map((p) => p.path).join(", ")}`
      : "Live 200 pages each have one H1.",
  });

  const canonicalGaps = baseline?.canonicalSummary.filter((c) => !c.canonical) || [];
  items.push({
    id: "canonicals",
    label: "Canonicals",
    status: canonicalGaps.length ? "warn" : pages.length ? "pass" : "in_progress",
    detail: canonicalGaps.length
      ? `No canonical tag on: ${canonicalGaps.map((c) => c.path).join(", ")}`
      : "Canonical tags present on inventoried pages.",
  });

  items.push({
    id: "sitemap",
    label: "Sitemap",
    status: baseline?.sitemap.ok ? "pass" : "fail",
    detail: baseline?.sitemap.ok
      ? `${baseline.sitemap.urls.length} URLs in sitemap.xml`
      : baseline?.sitemap.error || "sitemap.xml not found. Add app/sitemap.ts before production content launch.",
  });

  items.push({
    id: "robots",
    label: "Robots",
    status: baseline?.robotsTxt.ok ? "pass" : "fail",
    detail: baseline?.robotsTxt.ok
      ? "robots.txt reachable."
      : baseline?.robotsTxt.error || "robots.txt missing.",
  });

  const schemaCount = pages.filter((p) => p.schemaTypes.length).length;
  items.push({
    id: "schema",
    label: "Schema",
    status: schemaCount ? "pass" : "warn",
    detail: schemaCount
      ? `${schemaCount} pages expose JSON-LD.`
      : "No JSON-LD detected on the baseline. Add Organization/WebSite schema when approved — do not fake rich results.",
  });

  items.push({
    id: "internal-links",
    label: "Internal links",
    status: (baseline?.internalLinkSummary.uniqueTargets || 0) > 3 ? "pass" : "warn",
    detail: baseline
      ? `${baseline.internalLinkSummary.total} internal links across ${baseline.internalLinkSummary.uniqueTargets} unique targets.`
      : "Capture a baseline first.",
  });

  const missingAlt = pages.reduce((n, p) => n + p.missingAlt, 0);
  items.push({
    id: "alt",
    label: "Image alt text",
    status: missingAlt ? "warn" : "pass",
    detail: missingAlt ? `${missingAlt} images missing alt.` : "No missing alt attributes in the snapshot.",
  });

  const ogGaps = pages.filter((p) => p.statusCode === 200 && !p.ogTitle);
  items.push({
    id: "og",
    label: "Open Graph",
    status: ogGaps.length ? "warn" : "pass",
    detail: ogGaps.length
      ? `Missing og:title: ${ogGaps.map((p) => p.path).join(", ")}`
      : "Open Graph titles present on 200 pages.",
  });

  items.push({
    id: "performance",
    label: "Performance",
    status: "in_progress",
    detail: baseline
      ? `Avg TTFB ${baseline.performance.avgTtfbMs ?? "—"}ms via server fetch. Lighthouse not run.`
      : "No timing data yet.",
  });

  items.push({
    id: "mobile",
    label: "Mobile behavior",
    status: workspace.screenshots.some((s) => s.viewport === "mobile") ? "pass" : "in_progress",
    detail: workspace.screenshots.some((s) => s.viewport === "mobile")
      ? "Mobile screenshot attached by operator."
      : "Upload a mobile screenshot. Automated device lab is not wired.",
  });

  items.push({
    id: "forms",
    label: "Forms",
    status: baseline?.intakeFormHealth.launchBlocking ? "fail" : "pass",
    detail: baseline?.intakeFormHealth.notes.join(" ") || "No form health recorded.",
  });

  const stagingIndexable = staged.filter((p) => p.status === "staged" && !p.noindex);
  items.push({
    id: "staging-noindex",
    label: "Staging remains noindex",
    status: stagingIndexable.length ? "fail" : "pass",
    detail: stagingIndexable.length
      ? "A staged page is missing noindex — block production."
      : "Staged factory pages are noindex until production approval.",
  });

  return items;
}

export function pagePublicReady(page: FactoryPage): boolean {
  return page.status === "published" && Boolean(page.approvedBy) && Boolean(page.body.trim());
}
