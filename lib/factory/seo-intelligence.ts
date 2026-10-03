import { gscConfigured } from "./search-console";
import { buildPreflight, type PreflightItem } from "./preflight";
import { FACTORY_PROJECT_ID } from "./types";
import type {
  BaselineSnapshot,
  ContentBrief,
  FactoryWorkspace,
  IndexingRecord,
  PageAudit,
} from "./types";
import { catalogSite, originKey, SEO_SITE_CATALOG } from "./seo-sites";
import { listBaselines, readWorkspace } from "./workspace";

export type SeoSite = {
  id: string;
  name: string;
  origin: string;
  projectId: string;
  internal: boolean;
  kind: "production" | "internal_demo";
  note: string;
  crawlOrigin?: string;
};

export type SeoIssue = {
  id: string;
  severity: "fail" | "warn";
  type: string;
  path: string;
  detail: string;
  implemented: true;
};

export type SeoPageRow = {
  path: string;
  url: string;
  statusCode: number | null;
  title: string;
  metaDescription: string;
  wordCount: number;
  h1: string[];
  h2: string[];
  h3Count: number;
  canonical: string;
  robots: string;
  schemaTypes: string[];
  warnings: string[];
  source: "baseline" | "planned";
};

export type SeoRefreshItem = {
  id: string;
  path: string;
  reason: string;
  briefTitle?: string;
  href: string;
};

export type SeoModel = {
  site: SeoSite;
  sites: SeoSite[];
  baseline: BaselineSnapshot | null;
  gscConfigured: boolean;
  preflight: PreflightItem[];
  pages: SeoPageRow[];
  issues: SeoIssue[];
  refresh: SeoRefreshItem[];
  indexing: IndexingRecord[];
  backlinkCount: number;
  summary: {
    inventoried: number;
    plannedNotLive: number;
    preflightFails: number;
    preflightWarns: number;
    issueFails: number;
    issueWarns: number;
    indexingKnown: number;
    indexingIndexed: number;
    avgTtfbMs: number | null;
    lighthouse: string;
  };
  absentCapabilities: string[];
};

export function listSeoSites(workspace: FactoryWorkspace, baselines: BaselineSnapshot[]): SeoSite[] {
  const sites = new Map<string, SeoSite>();
  for (const row of SEO_SITE_CATALOG) {
    sites.set(row.id, {
      id: row.id,
      name: row.name,
      origin: row.origin,
      projectId: row.id,
      internal: true,
      kind: row.kind,
      note: row.note,
    });
  }
  const primary = sites.get(workspace.project.id || FACTORY_PROJECT_ID);
  if (primary) {
    primary.origin = workspace.project.productionUrl || primary.origin;
    primary.name = workspace.project.name || primary.name;
  }
  for (const snapshot of baselines) {
    const catalogId =
      snapshot.siteId && sites.has(snapshot.siteId)
        ? snapshot.siteId
        : [...sites.values()].find((site) => originKey(site.origin) === originKey(snapshot.origin))?.id;
    if (catalogId) {
      const site = sites.get(catalogId);
      if (site) site.crawlOrigin = snapshot.origin;
      continue;
    }
    const id = `origin:${originKey(snapshot.origin)}`;
    if (!sites.has(id)) {
      sites.set(id, {
        id,
        name: snapshot.origin,
        origin: snapshot.origin,
        projectId: snapshot.siteId || snapshot.projectId,
        internal: true,
        kind: snapshot.origin.includes("/demo/") ? "internal_demo" : "production",
        note: "Discovered from a stored baseline. Not a Search Console property unless proven otherwise.",
        crawlOrigin: snapshot.origin,
      });
    }
  }
  return [...sites.values()];
}

function pickBaseline(baselines: BaselineSnapshot[], site: SeoSite) {
  const bySite = baselines
    .filter((row) => row.siteId === site.id || row.projectId === site.id)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (bySite.length) return bySite.at(-1) || null;
  const byOrigin = baselines
    .filter((row) => originKey(row.origin) === originKey(site.crawlOrigin || site.origin))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return byOrigin.at(-1) || null;
}

function duplicateKeys(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function pageWarnings(page: PageAudit, duplicateTitles: Set<string>, duplicateMetas: Set<string>) {
  const warnings: string[] = [];
  if (page.statusCode === 200 && !page.title.trim()) warnings.push("Missing title");
  if (page.statusCode === 200 && !page.metaDescription.trim()) warnings.push("Missing meta");
  else if (page.metaDescription.trim().length && page.metaDescription.trim().length < 50) {
    warnings.push("Weak meta");
  }
  if (duplicateTitles.has(page.title.trim().toLowerCase())) warnings.push("Duplicate title");
  if (page.metaDescription && duplicateMetas.has(page.metaDescription.trim().toLowerCase())) {
    warnings.push("Duplicate meta");
  }
  if (page.statusCode === 200 && page.headings.h1.length === 0) warnings.push("Missing H1");
  if (page.headings.h1.length > 1) warnings.push("Multiple H1");
  if (page.statusCode === 200 && !page.canonical) warnings.push("Missing canonical");
  if (page.robots.toLowerCase().includes("noindex")) warnings.push("noindex");
  return warnings;
}

function buildIssues(baseline: BaselineSnapshot | null, pages: PageAudit[]): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const live = pages.filter((page) => page.statusCode === 200);
  const duplicateTitles = duplicateKeys(live.map((page) => page.title));
  const duplicateMetas = duplicateKeys(live.map((page) => page.metaDescription));

  for (const page of live) {
    if (!page.title.trim()) {
      issues.push({
        id: `title:${page.path}`,
        severity: "fail",
        type: "missing_title",
        path: page.path,
        detail: "No title tag on this 200 page.",
        implemented: true,
      });
    }
    if (!page.metaDescription.trim()) {
      issues.push({
        id: `meta:${page.path}`,
        severity: "fail",
        type: "missing_meta",
        path: page.path,
        detail: "No meta description.",
        implemented: true,
      });
    } else if (page.metaDescription.trim().length < 50) {
      issues.push({
        id: `weak-meta:${page.path}`,
        severity: "warn",
        type: "weak_meta",
        path: page.path,
        detail: `Meta is ${page.metaDescription.trim().length} characters.`,
        implemented: true,
      });
    }
    if (page.title && duplicateTitles.has(page.title.trim().toLowerCase())) {
      issues.push({
        id: `dup-title:${page.path}`,
        severity: "warn",
        type: "duplicate_title",
        path: page.path,
        detail: `Title reused: “${page.title.slice(0, 80)}”.`,
        implemented: true,
      });
    }
    if (page.metaDescription && duplicateMetas.has(page.metaDescription.trim().toLowerCase())) {
      issues.push({
        id: `dup-meta:${page.path}`,
        severity: "warn",
        type: "duplicate_meta",
        path: page.path,
        detail: "Meta description is duplicated on another inventoried page.",
        implemented: true,
      });
    }
    if (page.headings.h1.length === 0) {
      issues.push({
        id: `h1:${page.path}`,
        severity: "fail",
        type: "missing_h1",
        path: page.path,
        detail: "No H1.",
        implemented: true,
      });
    }
    if (page.headings.h1.length > 1) {
      issues.push({
        id: `h1s:${page.path}`,
        severity: "warn",
        type: "multiple_h1",
        path: page.path,
        detail: `${page.headings.h1.length} H1 tags.`,
        implemented: true,
      });
    }
    if (!page.canonical) {
      issues.push({
        id: `canon:${page.path}`,
        severity: "warn",
        type: "missing_canonical",
        path: page.path,
        detail: "No canonical tag.",
        implemented: true,
      });
    } else if (baseline) {
      const row = baseline.canonicalSummary.find((item) => item.path === page.path);
      if (row && !row.matches) {
        issues.push({
          id: `canon-mismatch:${page.path}`,
          severity: "warn",
          type: "canonical_mismatch",
          path: page.path,
          detail: `Canonical ${page.canonical} does not match the inventoried URL.`,
          implemented: true,
        });
      }
    }
    if (page.robots.toLowerCase().includes("noindex") && !page.path.startsWith("/app")) {
      issues.push({
        id: `noindex:${page.path}`,
        severity: "warn",
        type: "noindex",
        path: page.path,
        detail: `robots meta includes noindex (${page.robots || "noindex"}).`,
        implemented: true,
      });
    }
  }

  for (const link of baseline?.brokenLinks || []) {
    issues.push({
      id: `broken:${link.from}:${link.href}`,
      severity: "fail",
      type: "broken_internal_link",
      path: link.from,
      detail: `${link.href} (${link.error || link.status || "failed"})`,
      implemented: true,
    });
  }

  return issues;
}

function buildRefresh(
  pages: PageAudit[],
  briefs: ContentBrief[],
  workspace: FactoryWorkspace
): SeoRefreshItem[] {
  const items: SeoRefreshItem[] = [];
  for (const page of pages.filter((row) => row.statusCode === 200)) {
    if (page.wordCount > 0 && page.wordCount < 300) {
      items.push({
        id: `thin:${page.path}`,
        path: page.path,
        reason: `Thin copy (${page.wordCount} words).`,
        href: "/app/content",
      });
    }
    if (!page.metaDescription.trim()) {
      items.push({
        id: `meta-op:${page.path}`,
        path: page.path,
        reason: "Add a unique meta description.",
        href: "/app/content",
      });
    }
  }
  for (const brief of briefs) {
    if (brief.gaps.length) {
      items.push({
        id: `gap:${brief.id}`,
        path: `/${brief.slug}`,
        reason: brief.gaps[0],
        briefTitle: brief.title,
        href: "/app/content",
      });
    }
  }
  for (const page of workspace.pages) {
    if (page.status !== "published") {
      items.push({
        id: `draft:${page.slug}`,
        path: page.path,
        reason: `Factory page is ${page.status}${page.noindex ? ", noindex" : ""}.`,
        briefTitle: page.title,
        href: `/app/staging/${page.slug}`,
      });
    }
  }
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function loadSeoModel(siteId?: string): Promise<SeoModel> {
  const workspace = await readWorkspace();
  const baselines = await listBaselines();
  const sites = listSeoSites(workspace, baselines);
  const site = sites.find((row) => row.id === siteId) || sites[0];
  const catalog = catalogSite(site.id);
  site.note = catalog.note || site.note;
  site.kind = catalog.kind || site.kind;
  const baseline = pickBaseline(baselines, site);
  const preflight = buildPreflight(workspace, baseline);
  const inventory = baseline?.pageInventory || [];
  const duplicateTitles = duplicateKeys(inventory.filter((p) => p.statusCode === 200).map((p) => p.title));
  const duplicateMetas = duplicateKeys(
    inventory.filter((p) => p.statusCode === 200).map((p) => p.metaDescription)
  );

  const pages: SeoPageRow[] = inventory.map((page) => ({
    path: page.path,
    url: page.url,
    statusCode: page.statusCode,
    title: page.title,
    metaDescription: page.metaDescription,
    wordCount: page.wordCount,
    h1: page.headings.h1,
    h2: page.headings.h2,
    h3Count: page.headings.h3.length,
    canonical: page.canonical,
    robots: page.robots,
    schemaTypes: page.schemaTypes,
    warnings: pageWarnings(page, duplicateTitles, duplicateMetas),
    source: "baseline",
  }));

  const isSitesinc = site.id === FACTORY_PROJECT_ID;
  if (isSitesinc) {
    const inventoriedPaths = new Set(pages.map((page) => page.path));
    for (const planned of workspace.pages) {
      if (inventoriedPaths.has(planned.path)) continue;
      pages.push({
        path: planned.path,
        url: `${site.origin}${planned.path}`,
        statusCode: null,
        title: planned.title,
        metaDescription: planned.metaDescription,
        wordCount: planned.wordCount,
        h1: planned.headings.slice(0, 1),
        h2: planned.headings.slice(1),
        h3Count: 0,
        canonical: "",
        robots: planned.noindex ? "noindex" : "",
        schemaTypes: [],
        warnings: ["Not in live baseline — planned factory page"],
        source: "planned",
      });
    }
  }

  const issues = buildIssues(baseline, inventory);
  const refresh = isSitesinc ? buildRefresh(inventory, workspace.briefs, workspace) : buildRefresh(inventory, [], { ...workspace, pages: [] });
  const gsc = isSitesinc ? gscConfigured() : false;
  const indexing = isSitesinc ? workspace.indexing : [];
  const indexingKnown = indexing.filter((row) => row.lastChecked || row.state !== "not_submitted").length;
  const indexingIndexed = indexing.filter((row) => row.state === "indexed" && row.source === "search_console").length;

  return {
    site,
    sites,
    baseline,
    gscConfigured: gsc,
    preflight,
    pages,
    issues,
    refresh,
    indexing,
    backlinkCount: isSitesinc ? workspace.backlinks.length : 0,
    summary: {
      inventoried: inventory.length,
      plannedNotLive: pages.filter((page) => page.source === "planned").length,
      preflightFails: preflight.filter((item) => item.status === "fail").length,
      preflightWarns: preflight.filter((item) => item.status === "warn").length,
      issueFails: issues.filter((item) => item.severity === "fail").length,
      issueWarns: issues.filter((item) => item.severity === "warn").length,
      indexingKnown,
      indexingIndexed,
      avgTtfbMs: baseline?.performance.avgTtfbMs ?? null,
      lighthouse: baseline?.performance.lighthouse || "not_run",
    },
    absentCapabilities: [
      "Live Search Console coverage counts (token not configured or account locked)",
      "Automated Lighthouse / CWV lab scores",
      "Keyword rank tracking",
      "Crawl budget modeling",
      "Link spam scoring",
      ...(isSitesinc
        ? []
        : ["Independent production domain (this is an internal noindex demo until a live client origin exists)"]),
    ],
  };
}

export { SEO_TABS } from "./seo-nav";
