/**
 * Local SEO audit adapter (Tiers 1-3): crawls a customer site with the factory page parser
 * (lib/factory/crawl.ts parsePage) and the factory discovery helpers (lib/factory/crawl-discovery.ts)
 * over an SSRF-safe fetcher, same-origin only, capped at SEO_AUDIT_PAGE_LIMIT pages.
 *
 * Discovery seeds from the homepage plus the XML sitemap and follows same-origin links, respecting
 * robots.txt Disallow rules (blocked sitemap pages are reported, never fetched). Internal link targets
 * the crawl itself could not visit are probed once, so broken links can be named together with the
 * pages that link to them.
 *
 * Tier 2 adds: Core Web Vitals for the homepage from Google's PageSpeed Insights API (one call,
 * honest degradation on any failure), structured-data property validation against the parsed JSON-LD
 * (parsePage only records type names, so the blocks are parsed again here), internal-link click-depth
 * analysis, a prioritized "fix these first" plan, and a before/after delta against the previous audit
 * summary stored for the same origin in the SiteFlow document store.
 *
 * Tier 3 ("the local moat") adds a Local presence section: NAP (name/address/phone) extraction from
 * the schema and the page text with consistency checks, LocalBusiness completeness beyond the Tier 2
 * required/recommended properties, Google Business Profile signals that are verifiable from the
 * website itself (plus a live Places comparison when GOOGLE_PLACES_API_KEY is configured), a
 * directory/social profile-link spot-check, and near-duplicate (doorway) page detection over the
 * visible text captured during the crawl.
 *
 * The factory's captureBaseline() is deliberately NOT used here: it is wired to Sitesinc's own factory
 * (workspace pages, intake-form probes, GA/Search-Console state) and fetches without the SSRF guard
 * this generator needs for customer-supplied URLs.
 */
import { parsePage } from "@/lib/factory/crawl";
import { crawlablePath, enqueue, isDisallowed, newDiscovery, robotsDisallows } from "@/lib/factory/crawl-discovery";
import type { PageAudit } from "@/lib/factory/types";
import { esc, reportDocument } from "../html";
import { assertSafeUrl, safeFetchText, UnsafeUrlError } from "../safe-fetch";
import { NonRetryableError } from "./errors";

export const SEO_AUDIT_PAGE_LIMIT = 100;
const CRAWL_BUDGET_MS = 120_000;
/** Uncrawled internal link targets probed for link health (one light fetch each). */
const PROBE_LIMIT = 40;
/** Per-(segment, depth) cap for link-discovered pages, so one dynamic template cannot eat the budget. */
const LINK_GROUP_LIMIT = 10;
/** HTML heavier than this is flagged: it usually means a bloated page builder or plugin stack. */
const OVERSIZED_PAGE_BYTES = 1_000_000;
/** Server first-response slower than this (single crawl fetch, not a lab speed test) is flagged. */
const SLOW_TTFB_MS = 2_000;

type Issue = { severity: "high" | "medium" | "low"; page: string; issue: string; fix: string };

export type BrokenLinkInfo = { from: string; path: string; status: number | null; error: string };

/** One parsed JSON-LD block (a single @graph node counts as one entry). */
export type JsonLdNode = Record<string, unknown>;

/** A crawled page plus generator-side extras parsed from the same fetched HTML: its JSON-LD blocks
 * (parsePage itself only records the type names), its normalized visible text (Tier 3: contact-signal
 * extraction and near-duplicate detection; memory-only, never persisted), and whether it embeds a
 * Google Map. Hand-built fixtures may omit all three; the checks that need them then stay silent. */
export type AuditedPage = PageAudit & { jsonLd?: JsonLdNode[]; text?: string; embedsMap?: boolean };

/** Visible text of a page: script/style/comments stripped, tags removed, whitespace collapsed. */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30_000);
}

/** True when the page embeds a Google Map (an iframe pointing at Google Maps). */
export function detectMapEmbed(html: string): boolean {
  return /<iframe[^>]+src=["'][^"']*(?:google\.[a-z.]+\/maps|maps\.google\.)/i.test(html);
}

/**
 * Parse the JSON-LD blocks out of raw HTML, flattening arrays and @graph like the factory's
 * schemaTypes() does. Unparseable blocks are skipped here (parsePage already flags them through
 * the "InvalidJSON-LD" schema type, which Tier 1 reports).
 */
export function parseJsonLd(html: string): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const json = JSON.parse(match[1]);
      const top = Array.isArray(json) ? json : [json];
      for (const node of top) {
        if (!node || typeof node !== "object") continue;
        if (Array.isArray((node as JsonLdNode)["@graph"])) {
          for (const item of (node as JsonLdNode)["@graph"] as unknown[]) {
            if (item && typeof item === "object") nodes.push(item as JsonLdNode);
          }
        } else {
          nodes.push(node as JsonLdNode);
        }
      }
    } catch {
      // Invalid JSON-LD: reported via schemaTypes, nothing to validate here.
    }
  }
  return nodes;
}

export type CrawlResult = {
  origin: string;
  pages: AuditedPage[];
  robotsOk: boolean;
  sitemapOk: boolean;
  https: boolean;
  /** Same-origin paths listed in the XML sitemap (empty when there is no usable sitemap). */
  sitemapPaths: string[];
  /** Sitemap/linked paths that robots.txt disallows; recorded, never fetched. */
  blockedPaths: string[];
  /** Internal link targets confirmed broken (HTTP >= 400 or unreachable), with a page that links to them. */
  brokenLinks: BrokenLinkInfo[];
};

function sitemapLocPaths(origin: string, xml: string): string[] {
  const paths = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((m) => crawlablePath(origin, m[1].trim()))
    .filter(Boolean);
  return [...new Set(paths)];
}

export async function crawlSite(startUrl: string, opts: { maxPages?: number } = {}): Promise<CrawlResult> {
  const maxPages = Math.min(Math.max(1, opts.maxPages ?? SEO_AUDIT_PAGE_LIMIT), SEO_AUDIT_PAGE_LIMIT);
  let start: URL;
  try {
    start = assertSafeUrl(startUrl);
  } catch (err) {
    throw new NonRetryableError(err instanceof UnsafeUrlError ? `Cannot audit that URL: ${err.message}` : "Cannot audit that URL.");
  }
  const first = await safeFetchText(start.toString());
  if (!first.ok) {
    if (/private|reserved|not allowed|credentials|ports/i.test(first.error)) {
      throw new NonRetryableError(`Cannot audit that URL: ${first.error}`);
    }
    throw new Error(`The site did not answer (${first.error || `HTTP ${first.status}`}).`);
  }
  const origin = new URL(first.finalUrl).origin;
  const startPath = crawlablePath(origin, first.finalUrl) || "/";
  const deadline = Date.now() + CRAWL_BUDGET_MS;

  const [robots, sitemap] = await Promise.all([
    safeFetchText(`${origin}/robots.txt`, { maxBytes: 200_000 }),
    safeFetchText(`${origin}/sitemap.xml`, { maxBytes: 1_000_000 }),
  ]);
  const disallows = robots.ok ? robotsDisallows(robots.body) : [];
  const sitemapOk = sitemap.ok && /<urlset|<sitemapindex/i.test(sitemap.body);
  const sitemapPaths = sitemapOk ? sitemapLocPaths(origin, sitemap.body) : [];

  const pages: AuditedPage[] = [];
  const via = new Map<string, "seed" | "sitemap" | "link">([[startPath, "seed"]]);
  const blocked = new Set<string>();
  const discovery = newDiscovery([]);
  discovery.seen.add(startPath);
  const offer = (path: string, source: "sitemap" | "link") => {
    if (!path || path === startPath) return;
    if (isDisallowed(path, disallows)) {
      blocked.add(path);
      return;
    }
    if (enqueue(discovery, path, source === "sitemap" ? 1000 : LINK_GROUP_LIMIT)) via.set(path, source);
  };
  // Sitemap first: those are the pages the owner says matter, and sitemap-only pages are orphan candidates.
  for (const p of sitemapPaths) offer(p, "sitemap");

  const firstPage: AuditedPage = {
    ...parsePage(origin, startPath, first),
    jsonLd: parseJsonLd(first.body),
    text: visibleText(first.body),
    embedsMap: detectMapEmbed(first.body),
  };
  firstPage.discoveredVia = "seed";
  pages.push(firstPage);
  const harvest = (page: PageAudit) => {
    for (const href of page.internalLinks) offer(crawlablePath(origin, href), "link");
  };
  harvest(firstPage);
  while (discovery.queue.length && pages.length < maxPages && Date.now() < deadline) {
    const p = discovery.queue.shift()!;
    const fetched = await safeFetchText(`${origin}${p}`);
    if (fetched.ok && new URL(fetched.finalUrl).origin !== origin) continue;
    if (fetched.contentType && !/html/i.test(fetched.contentType)) continue;
    const page: AuditedPage = {
      ...parsePage(origin, p, fetched),
      jsonLd: parseJsonLd(fetched.body),
      text: visibleText(fetched.body),
      embedsMap: detectMapEmbed(fetched.body),
    };
    page.discoveredVia = via.get(p) ?? "link";
    pages.push(page);
    if (fetched.ok) harvest(page);
  }

  // Link health: every internal target either was crawled (status known) or gets one light probe.
  const crawledStatus = new Map(pages.map((p) => [p.path, p.statusCode]));
  const linkSources = new Map<string, Set<string>>();
  for (const page of pages) {
    for (const href of page.internalLinks) {
      const target = crawlablePath(origin, href);
      if (!target || target === page.path) continue;
      if (!linkSources.has(target)) linkSources.set(target, new Set());
      linkSources.get(target)!.add(page.path);
    }
  }
  const brokenLinks: BrokenLinkInfo[] = [];
  const pushBroken = (path: string, status: number | null, error: string) => {
    for (const from of linkSources.get(path) ?? []) {
      if (brokenLinks.length >= 200) return;
      if (!brokenLinks.some((b) => b.from === from && b.path === path)) brokenLinks.push({ from, path, status, error });
    }
  };
  for (const [target, status] of crawledStatus) {
    if (status !== null && status >= 400) pushBroken(target, status, `HTTP ${status}`);
  }
  const probeTargets = [...linkSources.keys()]
    .filter((t) => !crawledStatus.has(t) && !blocked.has(t))
    .sort()
    .slice(0, PROBE_LIMIT);
  for (const target of probeTargets) {
    if (Date.now() >= deadline) break;
    const probe = await safeFetchText(`${origin}${target}`, { maxBytes: 32_768, timeoutMs: 6_000 });
    if (probe.status >= 400) pushBroken(target, probe.status, probe.error || `HTTP ${probe.status}`);
    else if (!probe.ok && probe.status === 0 && !/abort|timed?\s*out/i.test(probe.error)) {
      // A timeout can be a slow page rather than a missing one; only hard failures count as broken.
      pushBroken(target, null, probe.error || "Fetch failed");
    }
  }

  return {
    origin,
    pages,
    robotsOk: robots.ok,
    sitemapOk,
    https: origin.startsWith("https:"),
    sitemapPaths,
    blockedPaths: [...blocked].sort(),
    brokenLinks,
  };
}

/**
 * Health score, 0-100. Starts at 100; each finding deducts by severity (high 5, medium 2, low 1).
 * A single page (one value of Issue.page, site-level findings excluded) can deduct at most
 * HEALTH_SCORE_PAGE_CAP points, so one disastrous page cannot zero a large, mostly healthy site;
 * the total deduction is capped at 100 so the score never goes below 0. It is a guide for what to
 * fix first, not a ranking prediction.
 */
export const HEALTH_SCORE_WEIGHTS = { high: 5, medium: 2, low: 1 } as const;
export const HEALTH_SCORE_PAGE_CAP = 20;

export function healthScore(issues: Issue[]): number {
  const perLocation = new Map<string, number>();
  let deduction = 0;
  for (const issue of issues) {
    const w = HEALTH_SCORE_WEIGHTS[issue.severity];
    if (issue.page === "site") {
      deduction += w;
      continue;
    }
    const soFar = perLocation.get(issue.page) ?? 0;
    const add = Math.min(w, Math.max(0, HEALTH_SCORE_PAGE_CAP - soFar));
    perLocation.set(issue.page, soFar + add);
    deduction += add;
  }
  return Math.max(0, 100 - Math.min(100, deduction));
}

/* ------------------------- structured-data validation (Tier 2) ------------------------ */

/**
 * Property expectations for the schema types a local-business site actually carries.
 * "required" = the property the type exists to convey (missing = medium finding);
 * "recommended" = strongly expected by search engines for rich results (missing = low).
 */
export const SCHEMA_PROPERTY_RULES: Record<string, { required: string[]; recommended: string[] }> = {
  LocalBusiness: { required: ["name", "address"], recommended: ["telephone"] },
  Organization: { required: ["name"], recommended: ["url"] },
  WebSite: { required: ["name"], recommended: ["url"] },
  BreadcrumbList: { required: ["itemListElement"], recommended: [] },
};

/** schema.org subtypes that follow the LocalBusiness rule. */
const LOCAL_BUSINESS_SUBTYPES = new Set([
  "AccountingService", "AnimalShelter", "Attorney", "AutoBodyShop", "AutoDealer", "AutoRepair",
  "Bakery", "BeautySalon", "ChildCare", "Dentist", "DryCleaningOrLaundry", "Electrician",
  "EmergencyService", "EmploymentAgency", "FinancialService", "FoodEstablishment", "GeneralContractor",
  "HairSalon", "HealthAndBeautyBusiness", "HomeAndConstructionBusiness", "HVACBusiness", "LegalService",
  "Locksmith", "MedicalBusiness", "MovingCompany", "Plumber", "ProfessionalService", "RealEstateAgent",
  "Restaurant", "RoofingContractor", "Store",
]);

function schemaRuleFor(type: string): { label: string; rule: { required: string[]; recommended: string[] } } | null {
  if (SCHEMA_PROPERTY_RULES[type]) return { label: type, rule: SCHEMA_PROPERTY_RULES[type] };
  if (LOCAL_BUSINESS_SUBTYPES.has(type)) return { label: type, rule: SCHEMA_PROPERTY_RULES.LocalBusiness };
  return null;
}

function propPresent(node: JsonLdNode, prop: string): boolean {
  const v = node[prop];
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return typeof v === "number" || typeof v === "boolean";
}

export type SchemaGap = { type: string; prop: string; severity: Issue["severity"]; pages: string[] };

/** Every (schema type, missing property) gap in the crawl, with the pages it appears on. */
export function schemaPropertyGaps(result: CrawlResult): SchemaGap[] {
  const byKey = new Map<string, SchemaGap & { pageSet: Set<string> }>();
  for (const page of result.pages) {
    if (!page.jsonLd) continue;
    if ((page.statusCode !== null && page.statusCode >= 400) || (page.error && !page.statusCode)) continue;
    // Union over this page's nodes: a property counts as present if ANY node of the type carries it.
    const presentByLabel = new Map<string, { rule: { required: string[]; recommended: string[] }; props: Set<string> }>();
    for (const node of page.jsonLd) {
      const raw = node["@type"];
      const types = (Array.isArray(raw) ? raw : [raw]).filter((t): t is string => typeof t === "string");
      for (const type of types) {
        const resolved = schemaRuleFor(type);
        if (!resolved) continue;
        if (!presentByLabel.has(resolved.label)) presentByLabel.set(resolved.label, { rule: resolved.rule, props: new Set() });
        const entry = presentByLabel.get(resolved.label)!;
        for (const prop of [...resolved.rule.required, ...resolved.rule.recommended]) {
          if (propPresent(node, prop)) entry.props.add(prop);
        }
      }
    }
    for (const [label, { rule, props }] of presentByLabel) {
      const checks: { prop: string; severity: Issue["severity"] }[] = [
        ...rule.required.map((prop) => ({ prop, severity: "medium" as const })),
        ...rule.recommended.map((prop) => ({ prop, severity: "low" as const })),
      ];
      for (const { prop, severity } of checks) {
        if (props.has(prop)) continue;
        const key = `${label}|${prop}`;
        if (!byKey.has(key)) byKey.set(key, { type: label, prop, severity, pages: [], pageSet: new Set() });
        const gap = byKey.get(key)!;
        if (!gap.pageSet.has(page.path)) {
          gap.pageSet.add(page.path);
          gap.pages.push(page.path);
        }
      }
    }
  }
  return [...byKey.values()].map(({ pageSet, ...gap }) => {
    void pageSet;
    return { ...gap, pages: gap.pages.sort() };
  });
}

/* --------------------------- internal-link depth (Tier 2) ----------------------------- */

/** Click depth of every crawled page from the homepage (the crawl's seed page), BFS over internal links. */
export function linkDepths(result: CrawlResult): Map<string, number> {
  const depths = new Map<string, number>();
  const home = result.pages[0];
  if (!home) return depths;
  const byPath = new Map(result.pages.map((p) => [p.path, p]));
  depths.set(home.path, 0);
  const queue = [home.path];
  while (queue.length) {
    const current = queue.shift()!;
    const page = byPath.get(current);
    if (!page) continue;
    for (const href of page.internalLinks) {
      const target = crawlablePath(result.origin, href);
      if (!target || target === current || depths.has(target) || !byPath.has(target)) continue;
      depths.set(target, depths.get(current)! + 1);
      queue.push(target);
    }
  }
  return depths;
}

/** Mean click depth of the pages reachable from the homepage (homepage itself excluded); null when there are none. */
export function averageLinkDepth(result: CrawlResult): number | null {
  const home = result.pages[0];
  if (!home) return null;
  const rest = [...linkDepths(result).entries()].filter(([path]) => path !== home.path).map(([, d]) => d);
  if (!rest.length) return null;
  return rest.reduce((a, b) => a + b, 0) / rest.length;
}

export type AuditOptions = {
  /** Live Google Places comparison data (Tier 3) when a lookup ran; absent/null = no comparison. */
  places?: PlacesNap | null;
};

export function auditIssues(result: CrawlResult, opts: AuditOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Issue["severity"], page: string, issue: string, fix: string) => issues.push({ severity, page, issue, fix });
  if (!result.https) add("high", "site", "The site is served over plain HTTP.", "Serve every page over HTTPS and redirect HTTP to HTTPS.");
  if (!result.sitemapOk) add("medium", "site", "No XML sitemap at /sitemap.xml.", "Publish a sitemap listing your real pages and reference it in robots.txt.");
  if (!result.robotsOk) add("low", "site", "No robots.txt file.", "Add a robots.txt that allows crawling and points to the sitemap.");

  // Crawlability: pages the owner lists in the sitemap but robots.txt blocks.
  const blockedSet = new Set(result.blockedPaths);
  const blockedSitemap = result.sitemapPaths.filter((p) => blockedSet.has(p));
  if (blockedSitemap.length > 0 && blockedSitemap.length === result.sitemapPaths.length) {
    add("high", "site", "robots.txt blocks every page listed in your sitemap, so search engines cannot crawl any of them.", "Remove the blanket Disallow rule from robots.txt, or narrow it to admin and private areas only.");
  } else {
    for (const p of blockedSitemap.slice(0, 10)) {
      add("medium", p, "This page is listed in your sitemap, but robots.txt blocks crawlers from it.", "If the page should appear in search, remove its Disallow rule from robots.txt; if it should stay hidden, take it out of the sitemap.");
    }
  }

  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  for (const p of result.pages) {
    const at = p.path;
    if (p.statusCode && p.statusCode >= 400) {
      add("high", at, `Page returns HTTP ${p.statusCode}.`, "Fix or redirect the broken page and update links to it.");
      continue;
    }
    if (p.error && !p.statusCode) {
      add("medium", at, `Page could not be fetched (${p.error}).`, "Check that the page loads for visitors and crawlers.");
      continue;
    }
    if (/noindex/i.test(p.robots)) add("high", at, "Page is marked noindex.", "Remove the noindex robots meta tag if this page should appear in search.");
    if (!p.title) add("high", at, "Missing <title>.", "Write a unique title (about 30-60 characters) naming the service and town.");
    else {
      if (p.title.length < 15) add("medium", at, `Title is very short (${p.title.length} chars).`, "Name the service and the town in the title.");
      if (p.title.length > 65) add("low", at, `Title is long (${p.title.length} chars) and may be cut off.`, "Keep the important words in the first 60 characters.");
      titles.set(p.title, [...(titles.get(p.title) || []), at]);
    }
    if (!p.metaDescription) add("medium", at, "Missing meta description.", "Add a 120-160 character description with the service, area and a reason to call.");
    else {
      if (p.metaDescription.length > 170) add("low", at, "Meta description is long and will be truncated.", "Trim it to about 160 characters.");
      descriptions.set(p.metaDescription, [...(descriptions.get(p.metaDescription) || []), at]);
    }
    if (p.headings.h1.length === 0) add("medium", at, "No H1 heading.", "Give the page one H1 that says what it is about.");
    if (p.headings.h1.length > 1) add("low", at, `${p.headings.h1.length} H1 headings.`, "Use a single H1; demote the rest to H2.");
    if (!p.canonical) add("low", at, "No canonical link.", "Add a self-referencing canonical URL.");
    if (p.missingAlt > 0) add("low", at, `${p.missingAlt} image(s) without alt text.`, "Describe each meaningful image in its alt attribute.");
    if (p.wordCount < 250) add("low", at, `Thin content (${p.wordCount} words).`, "Explain the service, area, prices or process in more depth.");
    if (!p.ogTitle || !p.ogImage) add("low", at, "Missing Open Graph title/image.", "Add og:title and og:image so shared links look right.");
    if (p.bytes !== null && p.bytes > OVERSIZED_PAGE_BYTES) {
      add("low", at, `Very heavy page (${Math.round(p.bytes / 1024)} KB of HTML).`, "Trim page weight (fewer plugins and widgets, leaner page-builder output) so the page loads fast on phones.");
    }
    if (p.ttfbMs !== null && p.ttfbMs > SLOW_TTFB_MS) {
      add("low", at, `Slow first response (${p.ttfbMs} ms when our crawler visited).`, "Ask your host about caching or faster hosting. This is one fetch from our crawler, not a full speed test — confirm with a speed tool before spending money.");
    }
    if (result.https) {
      const httpImages = p.images.filter((img) => /^http:\/\//i.test(img.src)).length;
      if (httpImages > 0) {
        add("low", at, `${httpImages} image(s) load over plain HTTP on an HTTPS page (mixed content).`, "Serve every image over HTTPS so browsers do not block it or mark the page as insecure.");
      }
    }
  }
  for (const [title, paths] of titles) {
    if (paths.length > 1) add("medium", paths.join(", "), `Duplicate title "${title.slice(0, 60)}".`, "Give every page its own title.");
  }
  for (const [desc, paths] of descriptions) {
    if (paths.length > 1) add("medium", paths.join(", "), `Duplicate meta description "${desc.slice(0, 60)}".`, "Give every page its own description naming its service and area.");
  }

  // Link health: one finding per broken target, naming the pages that link to it.
  const byTarget = new Map<string, { froms: Set<string>; status: number | null; error: string }>();
  for (const b of result.brokenLinks) {
    if (!byTarget.has(b.path)) byTarget.set(b.path, { froms: new Set(), status: b.status, error: b.error });
    byTarget.get(b.path)!.froms.add(b.from);
  }
  for (const [target, info] of byTarget) {
    const froms = [...info.froms];
    const where = `${froms.slice(0, 3).join(", ")}${froms.length > 3 ? ` and ${froms.length - 3} more page(s)` : ""}`;
    if (info.status) {
      add("high", target, `Broken link: ${where} link(s) to this page, which returns HTTP ${info.status}.`, "Fix the page, or update the links to point at a live page.");
    } else {
      add("high", target, `Broken link: ${where} link(s) to this page, which could not be reached (${info.error}).`, "Check the address the links point to, and fix the page or the links.");
    }
  }

  // Indexability: healthy crawled pages that the sitemap does not list.
  if (result.sitemapOk && result.sitemapPaths.length) {
    const inSitemap = new Set(result.sitemapPaths);
    const missing = result.pages
      .filter((p) => p.statusCode !== null && p.statusCode < 400 && !/noindex/i.test(p.robots) && !inSitemap.has(p.path))
      .map((p) => p.path);
    if (missing.length) {
      add("low", "site", `${missing.length} crawled page(s) are not listed in the sitemap: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}.`, "Add the pages you want found to the sitemap, or generate the sitemap from your real page list so it stays complete.");
    }
  }

  // Orphan pages: in the sitemap, but no other crawled page links to them.
  const inbound = new Map<string, number>();
  for (const p of result.pages) {
    for (const href of p.internalLinks) {
      const t = crawlablePath(result.origin, href);
      if (t && t !== p.path) inbound.set(t, (inbound.get(t) ?? 0) + 1);
    }
  }
  for (const p of result.pages) {
    if (p.discoveredVia === "sitemap" && (!p.statusCode || p.statusCode < 400) && (inbound.get(p.path) ?? 0) === 0) {
      add("medium", p.path, "Orphan page: it is in your sitemap, but no other page on your site links to it.", "Link to it from a relevant page — a menu, a service page or a post — so visitors and search engines can reach it.");
    }
  }

  // Structured-data validation (Tier 2): property-level checks on the parsed JSON-LD blocks.
  // Missing a required property is medium, a recommended one low. Findings aggregate per
  // (schema type, property) into ONE site finding naming the affected pages, because the gap
  // almost always lives in a single site template. Pages whose JSON-LD was never parsed
  // (hand-built fixtures, older crawls) are skipped — presence is Tier 1's check, not this one.
  for (const gap of schemaPropertyGaps(result)) {
    const where =
      gap.pages.length === 1
        ? `on ${gap.pages[0]}`
        : `on ${gap.pages.length} pages: ${gap.pages.slice(0, 5).join(", ")}${gap.pages.length > 5 ? "…" : ""}`;
    add(
      gap.severity,
      "site",
      `${gap.type} structured data is missing "${gap.prop}" ${where}.`,
      `Add "${gap.prop}" to the ${gap.type} JSON-LD block. It usually comes from one template or SEO-plugin setting, so one fix covers every affected page.`
    );
  }

  // Internal-link depth (Tier 2): pages reachable only after more than 3 clicks are buried.
  const depths = linkDepths(result);
  const buried = result.pages.filter(
    (p) => (depths.get(p.path) ?? 0) > 3 && (!p.statusCode || p.statusCode < 400) && !/noindex/i.test(p.robots)
  );
  if (buried.length) {
    add(
      "low",
      "site",
      `${buried.length} page(s) are buried more than 3 clicks from the homepage: ${buried.slice(0, 5).map((p) => p.path).join(", ")}${buried.length > 5 ? "…" : ""}.`,
      "Link important pages from the homepage, a menu or a hub page so visitors and search engines reach them within 2-3 clicks."
    );
  }

  const home = result.pages[0];
  if (home) {
    const hasTel = result.pages.some((p) => p.externalLinks.some((l) => l.startsWith("tel:")));
    const hasForm = result.pages.some((p) => p.forms.length > 0);
    if (!hasTel) add("medium", "site", "No tap-to-call (tel:) link found.", "Add a tel: link to your phone number in the header and contact page.");
    if (!hasForm && !hasTel) add("medium", "site", "No contact form or phone link found.", "Give visitors a clear way to contact you on every page.");
    const schema = result.pages.flatMap((p) => p.schemaTypes);
    if (!schema.some((t) => /LocalBusiness|Organization|Plumber|Electrician|Dentist|Restaurant|Store|Service/i.test(t))) {
      add("medium", "site", "No LocalBusiness / Organization structured data.", "Add LocalBusiness JSON-LD with name, address, phone, hours and service area.");
    }
    if (schema.includes("InvalidJSON-LD")) add("medium", "site", "Structured data contains invalid JSON.", "Fix the JSON-LD block so search engines can read it.");
  }
  // Local presence (Tier 3): NAP consistency, schema completeness, GBP website-side signals,
  // profile links, the Places comparison (when one ran) and near-duplicate pages.
  issues.push(...localPresenceIssues(result, opts));

  const order = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ---------------------------- Core Web Vitals (Tier 2) -------------------------------- */

export type CoreWebVitals = {
  /** Always "mobile": the strategy the single PageSpeed call per audit uses. */
  strategy: "mobile";
  fetchedAt: string;
  /** Lighthouse performance score, 0-100 (null when the API did not return one). */
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  /** Lab proxy shown when the API reports no INP for the page. */
  tbtMs: number | null;
};

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PAGESPEED_TIMEOUT_MS = 30_000;

/**
 * One PageSpeed Insights call for the homepage (mobile). Uses PAGESPEED_API_KEY when configured,
 * otherwise the keyless quota. ANY failure — network, quota, non-200, malformed payload — returns
 * null so the report degrades to an honest "unavailable" note instead of invented numbers.
 */
export async function fetchCoreWebVitals(
  targetUrl: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; apiKey?: string } = {}
): Promise<CoreWebVitals | null> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") return null;
  const params = new URLSearchParams({ url: targetUrl, strategy: "mobile", category: "performance" });
  const key = opts.apiKey ?? process.env.PAGESPEED_API_KEY ?? "";
  if (key) params.set("key", key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? PAGESPEED_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${PAGESPEED_ENDPOINT}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number | null } };
        audits?: Record<string, { numericValue?: number | null }>;
      };
    };
    const lighthouse = json?.lighthouseResult;
    if (!lighthouse) return null;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const audit = (id: string) => num(lighthouse.audits?.[id]?.numericValue);
    const score = num(lighthouse.categories?.performance?.score);
    return {
      strategy: "mobile",
      fetchedAt: new Date().toISOString(),
      performanceScore: score === null ? null : Math.round(score * 100),
      lcpMs: audit("largest-contentful-paint"),
      cls: audit("cumulative-layout-shift"),
      inpMs: audit("interaction-to-next-paint"),
      tbtMs: audit("total-blocking-time"),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Findings from real Core Web Vitals thresholds (homepage, mobile). Null CWV = no findings. */
export function cwvIssues(cwv: CoreWebVitals | null, homePath = "/"): Issue[] {
  if (!cwv) return [];
  const issues: Issue[] = [];
  const add = (severity: Issue["severity"], issue: string, fix: string) => issues.push({ severity, page: homePath, issue, fix });
  if (cwv.lcpMs !== null && cwv.lcpMs > 2_500) {
    add(
      cwv.lcpMs > 4_000 ? "high" : "medium",
      `Slow main-content load on mobile: the largest content on the homepage took ${(cwv.lcpMs / 1000).toFixed(1)}s to appear (Largest Contentful Paint, Google PageSpeed lab test).`,
      "Shrink the largest image or text block above the fold, compress hero images, and cut scripts that block rendering. Aim for under 2.5s."
    );
  }
  if (cwv.cls !== null && cwv.cls > 0.1) {
    add(
      cwv.cls > 0.25 ? "high" : "medium",
      `Page content jumps around on mobile: layout shift score ${cwv.cls.toFixed(2)} on the homepage (Cumulative Layout Shift, Google PageSpeed lab test).`,
      "Give images and embeds fixed sizes, reserve space for banners and popups, and avoid injecting content above existing text. Aim for under 0.1."
    );
  }
  if (cwv.inpMs !== null && cwv.inpMs > 200) {
    add(
      cwv.inpMs > 500 ? "high" : "medium",
      `Sluggish response to taps and clicks on mobile: ${Math.round(cwv.inpMs)}ms on the homepage (Interaction to Next Paint, Google PageSpeed lab test).`,
      "Trim heavy scripts and third-party widgets so the page reacts faster when visitors tap. Aim for under 200ms."
    );
  }
  return issues;
}

/* ----------------------------- prioritized fix plan (Tier 2) --------------------------- */

export type Effort = "Quick" | "Moderate" | "Involved";
export type FixPlanItem = { issue: Issue; pagesAffected: number; effort: Effort };

/**
 * Effort tag per check type. Quick = a setting or a line of copy; Moderate = template or link work
 * across pages; Involved = content writing, hosting or performance engineering.
 */
const EFFORT_INVOLVED = /served over plain HTTP|Thin content|Very heavy page|Slow first response|Largest Contentful Paint|layout shift score|Interaction to Next Paint/;
const EFFORT_QUICK = /Missing <title>|Title is (very short|long)|Missing meta description|Meta description is long|No H1 heading|H1 headings|No canonical|without alt text|Open Graph|No robots\.txt|tap-to-call|marked noindex|Phone numbers disagree|Street addresses disagree|doesn't link your Yelp/;

export function effortForIssue(issue: Issue): Effort {
  if (EFFORT_INVOLVED.test(issue.issue)) return "Involved";
  if (EFFORT_QUICK.test(issue.issue)) return "Quick";
  return "Moderate";
}

/** How many pages a finding touches: site findings reach every crawled page; comma-joined page lists count their entries. */
export function pagesAffectedBy(issue: Issue, totalPages: number): number {
  if (issue.page === "site") return Math.max(1, totalPages);
  return Math.max(1, issue.page.split(",").map((s) => s.trim()).filter(Boolean).length);
}

/**
 * The top findings to fix first: severity weight (same weights as the health score) times pages
 * affected. Deterministic: ties fall to severity, then reach, then the finding text.
 */
export function fixPlan(issues: Issue[], totalPages: number, limit = 5): FixPlanItem[] {
  const weight = (i: Issue) => HEALTH_SCORE_WEIGHTS[i.severity];
  return issues
    .map((issue) => ({ issue, pagesAffected: pagesAffectedBy(issue, totalPages), effort: effortForIssue(issue) }))
    .sort(
      (a, b) =>
        weight(b.issue) * b.pagesAffected - weight(a.issue) * a.pagesAffected ||
        weight(b.issue) - weight(a.issue) ||
        b.pagesAffected - a.pagesAffected ||
        a.issue.issue.localeCompare(b.issue.issue)
    )
    .slice(0, limit);
}

/* ------------------------------ audit history / delta (Tier 2) ------------------------- */

export type AuditSummary = {
  origin: string;
  at: string;
  score: number;
  counts: { high: number; medium: number; low: number };
  /** Stable per-finding keys: page + normalized finding text (digits collapsed, so a changed count is not a "new" finding). */
  fingerprints: string[];
  /** Original finding text per fingerprint, for the delta lists. */
  labels: Record<string, string>;
};

export function issueFingerprint(issue: Issue): string {
  const normalized = issue.issue
    .toLowerCase()
    .replace(/\d+([.,]\d+)?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${issue.page}|${normalized}`;
}

export function summarizeAudit(origin: string, issues: Issue[], at: Date = new Date()): AuditSummary {
  const counts = { high: 0, medium: 0, low: 0 };
  const labels: Record<string, string> = {};
  for (const issue of issues) {
    counts[issue.severity] += 1;
    labels[issueFingerprint(issue)] = `${issue.page} — ${issue.issue}`.slice(0, 200);
  }
  return { origin, at: at.toISOString(), score: healthScore(issues), counts, fingerprints: Object.keys(labels).sort(), labels };
}

export type AuditDelta = {
  priorAt: string;
  scoreBefore: number;
  scoreAfter: number;
  resolved: string[];
  added: string[];
  stillOpen: number;
};

export function auditDelta(prior: AuditSummary, current: AuditSummary): AuditDelta {
  const before = new Set(prior.fingerprints);
  const now = new Set(current.fingerprints);
  return {
    priorAt: prior.at,
    scoreBefore: prior.score,
    scoreAfter: current.score,
    resolved: prior.fingerprints.filter((f) => !now.has(f)).map((f) => prior.labels[f] ?? f),
    added: current.fingerprints.filter((f) => !before.has(f)).map((f) => current.labels[f] ?? f),
    stillOpen: current.fingerprints.filter((f) => before.has(f)).length,
  };
}

/** Storage seam for audit history; the default reads/writes the SiteFlow document store. */
export type AuditHistoryStore = {
  read(origin: string): Promise<AuditSummary[]>;
  write(origin: string, history: AuditSummary[]): Promise<void>;
};

export const AUDIT_HISTORY_LIMIT = 5;

function historyDocKey(origin: string): string {
  // Same convention as lib/siteflow/state.ts: everything under siteflow/, ids sanitized to the
  // store's key alphabet (no ":" or "://" allowed), so the doc is siteflow/seo-audit-history/<id>.
  const id = origin.replace(/[^a-z0-9_.-]/gi, "_").replace(/^[^a-z0-9]+/i, "x");
  return `siteflow/seo-audit-history/${id}`;
}

const docHistoryStore: AuditHistoryStore = {
  async read(origin) {
    const { readDoc } = await import("@/lib/persistence");
    const doc = await readDoc<AuditSummary[]>(historyDocKey(origin));
    return Array.isArray(doc?.value) ? doc.value : [];
  },
  async write(origin, history) {
    const { writeDoc } = await import("@/lib/persistence");
    await writeDoc(historyDocKey(origin), history);
  },
};

function isAuditSummary(v: unknown): v is AuditSummary {
  const s = v as AuditSummary;
  return Boolean(s && typeof s.origin === "string" && typeof s.score === "number" && Array.isArray(s.fingerprints));
}

/** Stored summaries for an origin, oldest first. Any storage failure reads as "no history". */
export async function readAuditHistory(origin: string, store: AuditHistoryStore = docHistoryStore): Promise<AuditSummary[]> {
  try {
    const list = await store.read(origin);
    return Array.isArray(list) ? list.filter(isAuditSummary) : [];
  } catch {
    return [];
  }
}

/** Append a summary, keeping only the most recent AUDIT_HISTORY_LIMIT. Failures are swallowed: history must never break a paid report. */
export async function recordAuditSummary(summary: AuditSummary, store: AuditHistoryStore = docHistoryStore): Promise<void> {
  try {
    const prior = await readAuditHistory(summary.origin, store);
    await store.write(summary.origin, [...prior, summary].slice(-AUDIT_HISTORY_LIMIT));
  } catch {
    // The report itself is already generated; a lost history entry only loses the next delta.
  }
}

/* ------------------------------ local presence (Tier 3) ------------------------------- */

/** Normalize a phone number to its comparison key: digits only, US country code dropped. */
export function normalizePhoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

const TEXT_PHONE_RE = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g;

/** Phone-number-looking strings in visible page text (raw forms, unnormalized). */
export function extractPhonesFromText(text: string): string[] {
  return [...text.matchAll(TEXT_PHONE_RE)].map((m) => m[0].trim());
}

const STREET_SUFFIXES: Record<string, string> = {
  st: "street", street: "street", ave: "avenue", avenue: "avenue", blvd: "boulevard", boulevard: "boulevard",
  rd: "road", road: "road", dr: "drive", drive: "drive", ln: "lane", lane: "lane", ct: "court", court: "court",
  cir: "circle", circle: "circle", pl: "place", place: "place", way: "way", hwy: "highway", highway: "highway",
  pkwy: "parkway", parkway: "parkway", ter: "terrace", terrace: "terrace", trl: "trail", trail: "trail",
};

const STREET_ADDRESS_RE =
  /\b\d{1,6}\s+(?:[A-Za-z0-9.'’-]+\s+){0,3}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Place|Pl|Way|Highway|Hwy|Parkway|Pkwy|Terrace|Ter|Trail|Trl)\b\.?/gi;

/** Comparison form of a street address: lowercase, punctuation-free, abbreviations expanded, unit numbers dropped. */
export function normalizeStreet(display: string): string {
  return display
    .replace(/#.*$/, " ")
    .replace(/\b(?:suite|ste|apt|apartment|unit)\b\.?\s*[\w-]+/gi, " ")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => STREET_SUFFIXES[w] ?? w)
    .join(" ");
}

/** Street addresses in a text blob, as display + normalized pairs (first occurrence wins per normalized form). */
export function extractStreetAddresses(text: string): { display: string; normalized: string }[] {
  const out = new Map<string, string>();
  for (const m of text.matchAll(STREET_ADDRESS_RE)) {
    const display = m[0].replace(/\s+/g, " ").trim();
    const normalized = normalizeStreet(display);
    if (normalized && !out.has(normalized)) out.set(normalized, display);
  }
  return [...out.entries()].map(([normalized, display]) => ({ display, normalized }));
}

function isLocalBusinessNode(node: JsonLdNode): boolean {
  const raw = node["@type"];
  const types = (Array.isArray(raw) ? raw : [raw]).filter((t): t is string => typeof t === "string");
  return types.some((t) => {
    const resolved = schemaRuleFor(t);
    return resolved !== null && resolved.rule === SCHEMA_PROPERTY_RULES.LocalBusiness;
  });
}

function pageBroken(page: AuditedPage): boolean {
  return (page.statusCode !== null && page.statusCode >= 400) || Boolean(page.error && !page.statusCode);
}

/** Every LocalBusiness JSON-LD node in the crawl, with the page it appeared on. */
export function localBusinessNodes(result: CrawlResult): { node: JsonLdNode; page: string }[] {
  const out: { node: JsonLdNode; page: string }[] = [];
  for (const page of result.pages) {
    if (!page.jsonLd || pageBroken(page)) continue;
    for (const node of page.jsonLd) if (isLocalBusinessNode(node)) out.push({ node, page: page.path });
  }
  return out;
}

function stringProp(node: JsonLdNode, prop: string): string {
  const v = node[prop];
  return typeof v === "string" ? v.trim() : "";
}

function schemaAddress(node: JsonLdNode): { street: string; city: string } {
  const addr = node["address"];
  if (typeof addr === "string") return { street: addr.trim(), city: "" };
  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    const a = addr as JsonLdNode;
    return { street: stringProp(a, "streetAddress"), city: stringProp(a, "addressLocality") };
  }
  return { street: "", city: "" };
}

export type SiteNap = {
  /** The richest LocalBusiness schema identity found (empty strings where a field is absent); null when no LocalBusiness schema exists. */
  schema: { name: string; phone: string; street: string; city: string } | null;
  /** Distinct raw business names across the site's LocalBusiness schema. */
  names: string[];
  /** Every distinct phone number published (schema, tel: links, page text), merged by normalized digits. */
  phones: { key: string; display: string; pages: string[] }[];
  /** Every distinct street address published (schema + page text), merged by normalized form. */
  addresses: { normalized: string; display: string; pages: string[] }[];
};

/** The business identity the site itself publishes: schema NAP plus contact signals extracted from pages. */
export function siteNap(result: CrawlResult): SiteNap {
  const nodes = localBusinessNodes(result);
  let schema: SiteNap["schema"] = null;
  let best = -1;
  const names: string[] = [];
  const phoneMap = new Map<string, { display: string; pages: Set<string> }>();
  const addrMap = new Map<string, { display: string; pages: Set<string> }>();
  const addPhone = (raw: string, page: string) => {
    const key = normalizePhoneKey(raw);
    if (key.replace(/\D/g, "").length < 7) return;
    if (!phoneMap.has(key)) phoneMap.set(key, { display: raw.trim(), pages: new Set() });
    const entry = phoneMap.get(key)!;
    // Display the most human-formatted raw form seen (the page text's "(909) 555-0142",
    // not the tel: href's "+19095550142"): most punctuation wins; ties go to the national
    // format (no leading "+"), then to the longer form.
    const readability = (s: string) => s.replace(/[0-9]/g, "").length;
    const betterDisplay = (candidate: string, current: string) => {
      if (readability(candidate) !== readability(current)) return readability(candidate) > readability(current);
      if (candidate.startsWith("+") !== current.startsWith("+")) return !candidate.startsWith("+");
      return candidate.length > current.length;
    };
    if (betterDisplay(raw.trim(), entry.display)) entry.display = raw.trim();
    entry.pages.add(page);
  };
  const addAddress = (display: string, page: string) => {
    const normalized = normalizeStreet(display);
    if (!normalized) return;
    if (!addrMap.has(normalized)) addrMap.set(normalized, { display: display.replace(/\s+/g, " ").trim(), pages: new Set() });
    addrMap.get(normalized)!.pages.add(page);
  };
  for (const { node, page } of nodes) {
    const name = stringProp(node, "name");
    if (name && !names.includes(name)) names.push(name);
    const phone = stringProp(node, "telephone");
    if (phone) addPhone(phone, page);
    const { street, city } = schemaAddress(node);
    if (street) addAddress(street, page);
    const richness = [name, phone, street].filter(Boolean).length;
    if (richness > best) {
      best = richness;
      schema = { name, phone, street, city };
    }
  }
  for (const page of result.pages) {
    if (pageBroken(page)) continue;
    for (const link of page.externalLinks) {
      if (/^tel:/i.test(link)) addPhone(link.replace(/^tel:/i, "").split(/[?;]/)[0], page.path);
    }
    if (page.text) {
      for (const raw of extractPhonesFromText(page.text)) addPhone(raw, page.path);
      for (const addr of extractStreetAddresses(page.text)) addAddress(addr.display, page.path);
    }
  }
  const byPage = (a: { pages: string[] }, b: { pages: string[] }) => a.pages[0].localeCompare(b.pages[0]);
  return {
    schema,
    names,
    phones: [...phoneMap.entries()].map(([key, v]) => ({ key, display: v.display, pages: [...v.pages].sort() })).sort(byPage),
    addresses: [...addrMap.entries()].map(([normalized, v]) => ({ normalized, display: v.display, pages: [...v.pages].sort() })).sort(byPage),
  };
}

/** True when the site publishes a verifiable local identity: LocalBusiness schema or a street address. */
export function hasLocalIdentity(result: CrawlResult): boolean {
  return localBusinessNodes(result).length > 0 || siteNap(result).addresses.length > 0;
}

function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["llc", "inc", "corp", "corporation", "company", "co", "ltd", "llp", "the"].includes(w))
    .join(" ");
}

/** LocalBusiness completeness fields beyond the Tier 2 required/recommended properties. */
const LOCAL_COMPLETENESS_PROPS = ["openingHours", "geo", "sameAs", "image", "priceRange", "url"] as const;

function completenessPropPresent(nodes: JsonLdNode[], prop: string): boolean {
  return nodes.some((node) => propPresent(node, prop) || (prop === "openingHours" && propPresent(node, "openingHoursSpecification")));
}

export type GoogleLinkStatus = { mapsLinked: boolean; reviewLinked: boolean; mapEmbedded: boolean };

/** Google Business Profile touchpoints that are verifiable from the website itself. */
export function googleLinkStatus(result: CrawlResult): GoogleLinkStatus {
  let mapsLinked = false;
  let reviewLinked = false;
  for (const page of result.pages) {
    for (const link of page.externalLinks) {
      if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|maps\.google\.|goo\.gl\/maps|[?&]cid=\d/i.test(link)) mapsLinked = true;
      if (/g\.page\/|search\.google\.[a-z.]+\/local\/writereview|writereview/i.test(link)) reviewLinked = true;
    }
  }
  return { mapsLinked, reviewLinked, mapEmbedded: result.pages.some((p) => p.embedsMap) };
}

const PROFILE_NETWORKS: { name: string; re: RegExp; big: boolean }[] = [
  { name: "Yelp", re: /yelp\.[a-z.]+/i, big: true },
  { name: "Facebook", re: /facebook\.com\//i, big: true },
  { name: "Instagram", re: /instagram\.com\//i, big: false },
  { name: "BBB", re: /bbb\.org\//i, big: false },
  { name: "Apple Maps", re: /maps\.apple\.com/i, big: true },
  { name: "Bing", re: /bing\.com\//i, big: false },
  { name: "Angi", re: /(angi\.com|angieslist\.com)/i, big: false },
  { name: "Nextdoor", re: /nextdoor\.com\//i, big: false },
];

/** Directory/social networks the site links to, in checklist order. */
export function linkedProfiles(result: CrawlResult): string[] {
  const links = result.pages.flatMap((p) => p.externalLinks);
  return PROFILE_NETWORKS.filter((n) => links.some((l) => n.re.test(l))).map((n) => n.name);
}

/* --------------------------- near-duplicate pages (Tier 3) ----------------------------- */

/** Pages whose visible text is at least this similar (Jaccard over word sets) count as near-duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.85;
/** Pages with fewer words than this are too small to compare (Tier 1 already flags thin content). */
export const MIN_WORD_SET_SIZE = 50;

export function pageWordSet(page: AuditedPage): Set<string> {
  if (!page.text) return new Set();
  return new Set(page.text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2));
}

export type DuplicateCluster = { pages: string[]; similarity: number };

/** Clusters of near-duplicate pages (union-find over pairwise Jaccard similarity of visible-text word sets). */
export function nearDuplicateClusters(result: CrawlResult): DuplicateCluster[] {
  const candidates = result.pages
    .filter((p) => !pageBroken(p))
    .map((p) => ({ path: p.path, words: pageWordSet(p) }))
    .filter((c) => c.words.size >= MIN_WORD_SET_SIZE);
  const parent = new Map(candidates.map((c) => [c.path, c.path]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  const pairSim = new Map<string, number>();
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      let inter = 0;
      for (const w of a.words) if (b.words.has(w)) inter++;
      const sim = inter / (a.words.size + b.words.size - inter);
      if (sim >= NEAR_DUPLICATE_THRESHOLD) {
        parent.set(find(a.path), find(b.path));
        pairSim.set(`${a.path}|${b.path}`, sim);
      }
    }
  }
  const groups = new Map<string, string[]>();
  for (const c of candidates) {
    const root = find(c.path);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(c.path);
  }
  const clusters: DuplicateCluster[] = [];
  for (const pages of groups.values()) {
    if (pages.length < 2) continue;
    const sorted = pages.sort();
    let min = 1;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const sim = pairSim.get(`${sorted[i]}|${sorted[j]}`) ?? pairSim.get(`${sorted[j]}|${sorted[i]}`);
        if (sim !== undefined) min = Math.min(min, sim);
      }
    }
    clusters.push({ pages: sorted, similarity: min });
  }
  return clusters.sort((a, b) => a.pages[0].localeCompare(b.pages[0]));
}

/** True when the cluster's page paths share a template and differ by only a token or two (the city swap). */
function clusterLooksLikeLocationPages(pages: string[]): boolean {
  const tokens = pages.map((p) => new Set(p.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
  const common = [...tokens[0]].filter((t) => tokens.every((s) => s.has(t)));
  if (common.length < 1) return false;
  return tokens.every((s) => [...s].filter((t) => !common.includes(t)).length <= 2);
}

/* ------------------------- Google Places comparison (Tier 3) --------------------------- */

export type PlacesNap = { name: string; address: string; phone: string };

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PLACES_TIMEOUT_MS = 15_000;

/**
 * ONE Google Places text-search call for the business (name + city). Uses GOOGLE_PLACES_API_KEY
 * unless an explicit key is passed. Any failure — no key, network, quota, no match — returns null
 * so the audit degrades to the website-side checks alone, never invented listing data.
 */
export async function fetchPlacesNap(
  businessName: string,
  city: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; apiKey?: string } = {}
): Promise<PlacesNap | null> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function" || !businessName.trim()) return null;
  const key = opts.apiKey ?? process.env.GOOGLE_PLACES_API_KEY ?? "";
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? PLACES_TIMEOUT_MS);
  try {
    const res = await fetchImpl(PLACES_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber",
      },
      body: JSON.stringify({ textQuery: `${businessName} ${city}`.trim(), maxResultCount: 1 }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: { displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string }[];
    };
    const place = json?.places?.[0];
    if (!place) return null;
    return {
      name: place.displayName?.text ?? "",
      address: place.formattedAddress ?? "",
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** All Tier 3 findings. Pure over the crawl result (+ the Places comparison when one ran). */
export function localPresenceIssues(result: CrawlResult, opts: AuditOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Issue["severity"], page: string, issue: string, fix: string) => issues.push({ severity, page, issue, fix });
  const nap = siteNap(result);
  const nodes = localBusinessNodes(result);

  // NAP: with local-business schema types present but no readable NAP anywhere, say so honestly.
  const hasLocalSchemaType = result.pages.some((p) =>
    p.schemaTypes.some((t) => {
      const resolved = schemaRuleFor(t);
      return resolved !== null && resolved.rule === SCHEMA_PROPERTY_RULES.LocalBusiness;
    })
  );
  if (nodes.length === 0 && nap.phones.length === 0 && nap.addresses.length === 0 && hasLocalSchemaType) {
    add(
      "medium",
      "site",
      "No machine-readable name, address or phone (NAP) found for this business on its own site.",
      "Add LocalBusiness structured data with your name, address and phone, and show the same details on your contact page. Without them, Google and directories can't verify this business from its own site — and neither can customers."
    );
  }

  // NAP consistency: formatting differences are normalized away before this point, so a conflict
  // here is a genuinely different number or address — the kind that costs the business customers.
  if (nap.phones.length > 1) {
    const list = nap.phones
      .slice(0, 3)
      .map((p) => `${p.display} (on ${p.pages.slice(0, 3).join(", ")}${p.pages.length > 3 ? "…" : ""})`)
      .join(" and ");
    add(
      "high",
      "site",
      `Phone numbers disagree across the site: ${list}.`,
      "Pick the one number that actually rings your business and use it everywhere — header, contact page and structured data. A wrong number costs you customers: people call once, reach the wrong place, and move on to the next business."
    );
  }
  if (nap.addresses.length > 1) {
    const list = nap.addresses
      .slice(0, 3)
      .map((a) => `"${a.display}" (on ${a.pages.slice(0, 3).join(", ")}${a.pages.length > 3 ? "…" : ""})`)
      .join(" and ");
    add(
      "high",
      "site",
      `Street addresses disagree across the site: ${list}.`,
      "Use the one real street address everywhere — contact page, footer and structured data — matching your Google Business Profile exactly. Different addresses split your local rankings and send customers to the wrong place."
    );
  }
  const nameVariants = new Map<string, string>();
  for (const name of nap.names) {
    const key = normalizeBusinessName(name);
    if (key && !nameVariants.has(key)) nameVariants.set(key, name);
  }
  if (nameVariants.size > 1) {
    add(
      "medium",
      "site",
      `The business name is written ${nameVariants.size} different ways in the site's structured data: ${[...nameVariants.values()].map((n) => `"${n}"`).join(" and ")}.`,
      "Pick one exact business name — the one on your Google Business Profile — and use it in every structured-data block, page title and footer."
    );
  }

  // LocalBusiness completeness beyond Tier 2's required/recommended properties: one aggregated
  // low finding listing what is missing, not one finding per field or per page.
  if (nodes.length > 0) {
    const all = nodes.map((n) => n.node);
    const missing = LOCAL_COMPLETENESS_PROPS.filter((prop) => !completenessPropPresent(all, prop));
    if (missing.length) {
      const pages = [...new Set(nodes.map((n) => n.page))].sort();
      const where = pages.length === 1 ? `on ${pages[0]}` : `on ${pages.length} pages: ${pages.slice(0, 5).join(", ")}${pages.length > 5 ? "…" : ""}`;
      add(
        "low",
        "site",
        `LocalBusiness structured data is missing recommended details (${missing.join(", ")}) ${where}.`,
        "Add the missing fields to the LocalBusiness JSON-LD — opening hours, map coordinates (geo), your profile links (sameAs), a photo, price range and the page URL. Search engines use them to show your business with hours, directions and photos instead of a plain link."
      );
    }
  }

  // GBP + directory checks activate once the site publishes a verifiable local identity
  // (LocalBusiness schema or a street address); the no-NAP finding above covers sites without one.
  const gate = nodes.length > 0 || nap.addresses.length > 0;
  if (gate) {
    const status = googleLinkStatus(result);
    if (!status.mapsLinked && !status.mapEmbedded) {
      add(
        "low",
        "site",
        "Your site doesn't link to your Google Maps listing, and no Google Map is embedded.",
        "Link your Google listing from your site and embed the map on your contact page — it's how customers and Google connect the two, and how visitors get directions in one tap."
      );
    }
    if (!status.reviewLinked) {
      add(
        "low",
        "site",
        "Your site has no Google review link.",
        "Add your Google review link (the g.page review link from your Google Business Profile) where happy customers will see it — it's how customers and Google connect the two, and it turns good jobs into new reviews."
      );
    }
    const linked = linkedProfiles(result);
    const missingBig = PROFILE_NETWORKS.filter((n) => n.big && !linked.includes(n.name)).map((n) => n.name);
    if (missingBig.length) {
      add(
        "low",
        "site",
        `Your site doesn't link your ${missingBig.join("/")} profiles — linking them ties your citations together.`,
        "Add links to your Yelp, Facebook and Apple Maps profiles in your footer or contact page, using the exact business name and details from your Google Business Profile."
      );
    }
  }

  // Live Places comparison (only when a lookup actually ran): listing-vs-site mismatches are high.
  const places = opts.places ?? null;
  if (places) {
    if (places.phone && nap.phones.length > 0) {
      const key = normalizePhoneKey(places.phone);
      if (!nap.phones.some((p) => p.key === key)) {
        add(
          "high",
          "site",
          `Your Google listing shows the phone number ${places.phone}, but your site shows ${nap.phones.map((p) => p.display).join(", ")}.`,
          "Make the number identical in both places — update whichever one is wrong. Customers who find a number that doesn't ring your business call the next listing instead."
        );
      }
    }
    if (places.address && nap.addresses.length > 0) {
      const placeStreets = extractStreetAddresses(places.address);
      if (placeStreets.length && !nap.addresses.some((a) => a.normalized === placeStreets[0].normalized)) {
        add(
          "high",
          "site",
          `Your Google listing shows the address "${places.address}", but your site shows "${nap.addresses[0].display}".`,
          "Make the street address identical in both places — update whichever one is wrong, in your Google Business Profile or on the site, so customers and Google see one business in one place."
        );
      }
    }
    if (places.name && nap.schema?.name) {
      const a = normalizeBusinessName(places.name);
      const b = normalizeBusinessName(nap.schema.name);
      if (a && b && a !== b && !a.includes(b) && !b.includes(a)) {
        add(
          "high",
          "site",
          `Your Google listing is named "${places.name}", but your site's structured data says "${nap.schema.name}".`,
          "Use one exact business name in both places — your signage and legal name — so Google treats the listing and the site as the same business."
        );
      }
    }
  }

  // Near-duplicate pages: one finding per cluster. City-swapped clusters get the doorway wording.
  for (const cluster of nearDuplicateClusters(result)) {
    const pct = Math.round(cluster.similarity * 100);
    const where = cluster.pages.join(", ");
    if (clusterLooksLikeLocationPages(cluster.pages)) {
      add(
        "medium",
        where,
        `Near-duplicate location pages: ${where} are about ${pct}% identical and differ mainly by city name. Location pages that differ only by city name read as doorway pages to Google.`,
        "Give each city page its own proof: local jobs you did there, reviews from that city, photos and details only a business that works there would know — not just a swapped city name."
      );
    } else {
      add(
        "medium",
        where,
        `Near-duplicate pages: ${where} are about ${pct}% identical in wording.`,
        "Rewrite each page for its own topic and audience, or merge them into one stronger page — near-identical pages compete with each other and both rank worse."
      );
    }
  }

  return issues;
}

export type RenderExtras = {
  /** Homepage Core Web Vitals: a value = measured, null = attempted but unavailable, absent = not measured. */
  cwv?: CoreWebVitals | null;
  /** Previous stored summary for this origin: a value = delta shown, null = first audit, absent = no history context. */
  prior?: AuditSummary | null;
  /** Google Places comparison (Tier 3): a value = a lookup ran, null = attempted but unavailable/not configured, absent = no Places context. */
  places?: PlacesNap | null;
};

/** The report's "Local presence" section: what the website itself proves about the business's local identity. */
export function localPresenceSection(result: CrawlResult, extras: RenderExtras = {}): string {
  if (extras.places === undefined && !hasLocalIdentity(result)) return "";
  const nap = siteNap(result);
  const status = googleLinkStatus(result);
  const profiles = linkedProfiles(result);
  const yesNo = (v: boolean) => (v ? "found" : "<strong>not found</strong>");
  const napLine = nap.schema?.name || nap.phones.length || nap.addresses.length
    ? `<p>What your site itself publishes: ${nap.schema?.name ? `<strong>${esc(nap.schema.name)}</strong>` : "no business name in structured data"}${nap.phones.length ? ` · phone ${nap.phones.map((p) => esc(p.display)).join(", ")}` : ""}${nap.addresses.length ? ` · ${nap.addresses.map((a) => esc(a.display)).join(", ")}` : ""}.</p>`
    : "<p>Your site publishes no machine-readable name, address or phone that we could find.</p>";
  let placesLine = "";
  if (extras.places) {
    const pl = extras.places;
    placesLine = `<p>We also compared your site with your Google listing, which shows <strong>${esc(pl.name || "—")}</strong>${pl.address ? `, ${esc(pl.address)}` : ""}${pl.phone ? `, ${esc(pl.phone)}` : ""}. Where it disagrees with your site, the disagreement is flagged in the findings above.</p>`;
  } else if (extras.places === null) {
    placesLine = `<p class="muted">A live comparison with your Google listing wasn't run this time (Google Places access isn't configured, or the lookup didn't answer), so the checks here use only what your website itself shows.</p>`;
  }
  return `<h2>Local presence</h2>
${napLine}
<ul>
<li>Google Maps listing link: ${yesNo(status.mapsLinked)}</li>
<li>Google review link: ${yesNo(status.reviewLinked)}</li>
<li>Embedded Google Map: ${yesNo(status.mapEmbedded)}</li>
<li>Directory &amp; social profiles linked from your site: ${profiles.length ? profiles.map((p) => esc(p)).join(", ") : "none found"}</li>
</ul>
${placesLine}
<p class="muted">Scope: your Google Business Profile's internals — categories, hours, photos and insights — can't be verified without the business owner's Google access. This section checks everything verifiable from the website itself. The directory check is a spot-check of the profile links on your own site, not a full citation audit across directories.</p>`;
}

export function renderSeoAuditReport(result: CrawlResult, extras: RenderExtras = {}): string {
  const homePath = result.pages[0]?.path ?? "/";
  const issues = [...auditIssues(result, { places: extras.places }), ...cwvIssues(extras.cwv ?? null, homePath)];
  const score = healthScore(issues);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.severity] += 1;
  const sev = (s: Issue["severity"]) => (s === "high" ? "bad" : s === "medium" ? "warn" : "muted");
  const pageRows = result.pages
    .map(
      (p) => `<tr><td>${esc(p.path)}</td><td>${p.statusCode ?? "—"}</td><td>${esc(p.title || "—")}</td><td>${p.headings.h1.length}</td><td>${p.wordCount}</td><td>${p.missingAlt}</td></tr>`
    )
    .join("\n");
  const issueRows = issues
    .map((i) => `<tr><td><span class="pill ${sev(i.severity)}">${i.severity}</span></td><td>${esc(i.page)}</td><td>${esc(i.issue)}</td><td>${esc(i.fix)}</td></tr>`)
    .join("\n");

  const avgDepth = averageLinkDepth(result);
  const planItems = fixPlan(issues, result.pages.length)
    .map(
      (item) =>
        `<li><span class="pill ${sev(item.issue.severity)}">${item.issue.severity}</span> <strong>${esc(item.issue.issue)}</strong><br><span class="muted">Fixing this affects ${item.pagesAffected === result.pages.length && item.issue.page === "site" ? `all ${result.pages.length} crawled page(s)` : `${item.pagesAffected} page(s)`}. Effort: ${item.effort}. ${esc(item.issue.fix)}</span></li>`
    )
    .join("\n");
  const fixPlanSection = issues.length
    ? `<h2>Fix these first</h2>
<p class="muted">The highest-payoff findings, ranked by priority times how many pages they touch.</p>
<ol>${planItems}</ol>`
    : "";

  let deltaSection = "";
  if (extras.prior !== undefined) {
    if (extras.prior === null) {
      deltaSection = `<h2>Since your last audit</h2>
<p>First audit for this site — future audits will show what changed.</p>`;
    } else {
      const delta = auditDelta(extras.prior, summarizeAudit(result.origin, issues));
      const change = delta.scoreAfter - delta.scoreBefore;
      const list = (labels: string[]) =>
        labels.length
          ? `<ul>${labels.slice(0, 10).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${labels.length > 10 ? `<p class="muted">…and ${labels.length - 10} more.</p>` : ""}`
          : "<p>None.</p>";
      deltaSection = `<h2>Since your last audit</h2>
<p>Previous audit: ${esc(new Date(delta.priorAt).toUTCString())}. Health score went from <strong>${delta.scoreBefore}</strong> to <strong>${delta.scoreAfter}</strong> (${change > 0 ? `+${change}` : change}). ${delta.stillOpen} earlier finding(s) are still open.</p>
<p><strong>Fixed since then (${delta.resolved.length}):</strong></p>
${list(delta.resolved)}
<p><strong>New since then (${delta.added.length}):</strong></p>
${list(delta.added)}`;
    }
  }

  let cwvSection = "";
  if (extras.cwv !== undefined) {
    if (extras.cwv === null) {
      cwvSection = `<h2>Speed: Core Web Vitals</h2>
<p>Performance data unavailable this run — Google's PageSpeed service did not return measurements for the homepage, so no speed numbers are shown rather than guessed. Every other part of this audit is unaffected.</p>`;
    } else {
      const cwv = extras.cwv;
      const secs = (ms: number | null) => (ms === null ? "not reported" : `${(ms / 1000).toFixed(1)}s`);
      const rows = [
        `<tr><td>Performance score (Lighthouse, mobile)</td><td>${cwv.performanceScore === null ? "not reported" : `${cwv.performanceScore} / 100`}</td></tr>`,
        `<tr><td>Largest Contentful Paint — how fast the main content appears</td><td>${secs(cwv.lcpMs)}</td></tr>`,
        `<tr><td>Cumulative Layout Shift — how much content jumps around</td><td>${cwv.cls === null ? "not reported" : cwv.cls.toFixed(2)}</td></tr>`,
        cwv.inpMs !== null
          ? `<tr><td>Interaction to Next Paint — how fast taps and clicks respond</td><td>${Math.round(cwv.inpMs)}ms</td></tr>`
          : `<tr><td>Total Blocking Time — lab stand-in for tap responsiveness (the service reported no INP for this page)</td><td>${cwv.tbtMs === null ? "not reported" : `${Math.round(cwv.tbtMs)}ms`}</td></tr>`,
      ].join("\n");
      cwvSection = `<h2>Speed: Core Web Vitals</h2>
<table><thead><tr><th>Measure</th><th>Homepage (mobile)</th></tr></thead><tbody>${rows}</tbody></table>
<p class="muted">Measured by Google PageSpeed Insights on ${esc(new Date(cwv.fetchedAt).toUTCString())}. These are lab results for the homepage on a simulated phone — real visitor timings vary by device and connection.</p>`;
    }
  }

  const body = `<h1>Local SEO audit: ${esc(result.origin)}</h1>
<p class="muted">Crawled ${result.pages.length} page(s) (limit ${SEO_AUDIT_PAGE_LIMIT}) on ${esc(new Date().toUTCString())}.${result.sitemapPaths.length ? ` The sitemap lists ${result.sitemapPaths.length} page(s).` : ""}${result.blockedPaths.length ? ` ${result.blockedPaths.length} page(s) were skipped because robots.txt blocks them.` : ""}${avgDepth !== null ? ` Pages sit an average of ${avgDepth.toFixed(1)} clicks from the homepage.` : ""}</p>
<h2>Health score: ${score} / 100</h2>
<p class="muted">How the score is calculated: it starts at 100 and deducts ${HEALTH_SCORE_WEIGHTS.high} points per high-priority finding, ${HEALTH_SCORE_WEIGHTS.medium} per medium and ${HEALTH_SCORE_WEIGHTS.low} per low; a single page can deduct at most ${HEALTH_SCORE_PAGE_CAP} points, and the score never goes below 0. Treat it as a guide for what to fix first — it is not a ranking prediction, and no score guarantees traffic.</p>
<p><strong>${counts.high}</strong> high, <strong>${counts.medium}</strong> medium and <strong>${counts.low}</strong> low priority findings.</p>
${fixPlanSection}
${deltaSection}
${cwvSection}
${localPresenceSection(result, extras)}
<h2>Findings and fixes</h2>
${issues.length ? `<table><thead><tr><th>Priority</th><th>Where</th><th>Finding</th><th>Fix</th></tr></thead><tbody>${issueRows}</tbody></table>` : "<p>No on-page issues found in the crawled pages.</p>"}
<h2>Pages crawled</h2>
<table><thead><tr><th>Path</th><th>HTTP</th><th>Title</th><th>H1s</th><th>Words</th><th>Images w/o alt</th></tr></thead><tbody>${pageRows}</tbody></table>
<h2>What this report is (and is not)</h2>
<p>An automated snapshot of the pages above: titles, descriptions, headings, canonicals, image text, structured data (including whether the important schema properties are filled in), contact paths, crawlability, internal links and their click depth, indexability, basic page weight and response-time signals, and — when Google's PageSpeed service answers — a lab measurement of the homepage's Core Web Vitals. It does not measure rankings or backlinks. The Local presence section covers your Google listing and directory citations only as far as they can be verified from your website itself — it cannot see inside your Google Business Profile or your reviews — and no audit can guarantee rankings or traffic.</p>`;
  return reportDocument(`Local SEO audit: ${result.origin}`, body);
}

export async function generateSeoAuditReport(input: { siteUrl?: string }): Promise<string> {
  if (!input.siteUrl) throw new NonRetryableError("SEO audit needs the website address.");
  const result = await crawlSite(input.siteUrl);
  // Tier 2 context: PageSpeed (degrades to null) and the previous audit summary for the delta.
  // Neither may break the paid deliverable, so both are failure-isolated.
  const cwv = await fetchCoreWebVitals(result.origin).catch(() => null);
  // Tier 3 context: one live Google Places comparison when a key is configured and the site's
  // schema names the business; degrades to null (website-side checks alone) otherwise.
  const nap = siteNap(result);
  let places: PlacesNap | null = null;
  if (process.env.GOOGLE_PLACES_API_KEY && nap.schema?.name) {
    places = await fetchPlacesNap(nap.schema.name, nap.schema.city).catch(() => null);
  }
  const history = await readAuditHistory(result.origin);
  const prior = history.length ? history[history.length - 1] : null;
  const issues = [...auditIssues(result, { places }), ...cwvIssues(cwv, result.pages[0]?.path ?? "/")];
  await recordAuditSummary(summarizeAudit(result.origin, issues));
  return renderSeoAuditReport(result, { cwv, prior, places });
}
