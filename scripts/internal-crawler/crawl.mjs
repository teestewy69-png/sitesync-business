#!/usr/bin/env node
/**
 * Internal crawler — pre-publish gate for our own sites.
 *
 * Crawls a base URL (a local build, a Netlify deploy-preview, or a live site)
 * using raw HTML only — no JavaScript rendering, exactly what search engines
 * and AI crawlers receive — and fails loudly on the classes of problems that
 * previously slipped through deploy after deploy:
 *
 *   1. Broken links   — every internal href/src target must return 200.
 *   2. Schema         — each page type must carry the JSON-LD it should;
 *                       any indexable page with zero JSON-LD is flagged.
 *   3. Visibility     — unexpected noindex/nofollow, missing canonical,
 *                       indexable pages missing from the sitemap,
 *                       duplicate <title> across pages.
 *   4. Basics         — non-200 status, missing title, missing meta
 *                       description, H1 count != 1.
 *
 * Usage:
 *   node scripts/internal-crawler/crawl.mjs [--base <URL>] [--out <dir>]
 *                                            [--max-pages 900] [--concurrency 8]
 *
 * Defaults: --base https://sitesinc.co  --out scripts/internal-crawler/out
 *
 * Exit code is non-zero when any category fails, so CI / publish checklists
 * can gate on it. Dependency-free: Node 18+ (global fetch) only.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    base: "https://sitesinc.co",
    out: path.join(SCRIPT_DIR, "out"),
    maxPages: 900,
    concurrency: 8,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") args.base = argv[++i];
    else if (a === "--out") args.out = path.resolve(argv[++i]);
    else if (a === "--max-pages") args.maxPages = parseInt(argv[++i], 10);
    else if (a === "--concurrency") args.concurrency = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log("Usage: node crawl.mjs [--base <URL>] [--out <dir>] [--max-pages N] [--concurrency N]");
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const BASE = new URL(args.base);
const TIMEOUT_MS = 10_000;
const UA = "SitesIncInternalCrawler/1.0 (+pre-publish QA gate; raw HTML, no JS)";

// Core commerce pages the 2026-11-25 audit added by hand because they are
// core pages that may be absent from the sitemap. A seed that returns
// non-200 AND is neither linked nor in the sitemap is ignored (the page
// simply does not exist on that site).
const SEED_PATHS = ["/store", "/cart", "/checkout"];

// Paths that are allowed to be noindex / excluded from content checks.
// Segment-boundary prefixes.
const UTILITY_PREFIXES = [
  "/app",
  "/api",
  "/cart",
  "/checkout",
  "/demo",
  "/case-study",
  "/go",
  "/thank-you",
  "/client-domain",
];

// Extensions treated as assets: valid link targets, never crawled as pages.
const ASSET_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico",
  ".css", ".js", ".mjs", ".json", ".pdf", ".zip", ".txt", ".xml",
  ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".webm", ".mp3", ".wav",
]);

// ---------------------------------------------------------------------------
// URL identity
// ---------------------------------------------------------------------------

function stripWww(host) {
  return host.replace(/^www\./, "");
}

const SITE_HOST = stripWww(BASE.hostname);

function isInternal(u) {
  return stripWww(u.hostname) === SITE_HOST;
}

/** Identity key for a page/target: www-stripped host + path (no query/hash). */
function pageKey(u) {
  const p = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  return `${stripWww(u.hostname)}${p}`;
}

/** Full fetch identity for link targets (keeps the query string). */
function targetKey(u) {
  return `${stripWww(u.hostname)}${u.pathname}${u.search}`;
}

function extOf(pathname) {
  const m = pathname.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return m ? m[1] : "";
}

function isUtilityPath(p) {
  return UTILITY_PREFIXES.some((pre) => p === pre || p.startsWith(pre + "/"));
}

/** Deliberately-noindexed bulk location pages: /locations/<slug>, noindex, not in sitemap. */
function isBulkLocation(p, inSitemap) {
  return p.startsWith("/locations/") && !inSitemap;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchRaw(url, { wantBody }) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "user-agent": UA, accept: "*/*" },
      });
      const contentType = res.headers.get("content-type") || "";
      let text = null;
      if (wantBody) {
        text = await res.text();
      } else if (res.body) {
        try { await res.body.cancel(); } catch { /* ignore */ }
      }
      clearTimeout(timer);
      return {
        ok: true,
        status: res.status,
        finalUrl: res.url,
        contentType,
        xRobotsTag: res.headers.get("x-robots-tag") || "",
        text,
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }
  }
  return { ok: false, status: 0, finalUrl: url, contentType: "", xRobotsTag: "", text: null, error: String(lastError && lastError.message ? lastError.message : lastError) };
}

/** Run fn over items with a fixed number of workers. */
async function pool(items, n, fn) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// HTML parsing (regex-based; raw HTML only, tolerant of attribute order)
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    const name = m[1].toLowerCase();
    if (name === tag.slice(1).split(/[\s/>]/)[0].toLowerCase()) continue; // tag name itself
    attrs[name] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return attrs;
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function collectTypes(node, set) {
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, set);
  } else if (node && typeof node === "object") {
    const t = node["@type"];
    if (typeof t === "string") set.add(t);
    if (Array.isArray(t)) for (const x of t) if (typeof x === "string") set.add(x);
    for (const v of Object.values(node)) collectTypes(v, set);
  }
}

function parsePage(html) {
  const out = {
    title: null,
    metaDescription: null,
    robotsMeta: "",
    canonical: null,
    h1Count: 0,
    jsonLdTypes: new Set(),
    jsonLdBlocks: 0,
    hasFaqHeading: false,
    anchorHrefs: [],
    allTargets: [],
  };

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) out.title = stripTags(titleM[1]) || null;

  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    const name = (a.name || "").toLowerCase();
    if (name === "description" && a.content) out.metaDescription = a.content.trim();
    if (name === "robots" && a.content) out.robotsMeta = a.content.toLowerCase();
  }

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    if ((a.rel || "").toLowerCase().split(/\s+/).includes("canonical") && a.href) {
      out.canonical = a.href;
    }
    if (a.href) out.allTargets.push(a.href);
  }

  out.h1Count = (html.match(/<h1[\s>]/gi) || []).length;

  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripTags(m[2]).toLowerCase();
    if (/\bfaqs?\b/.test(text) || text.includes("frequently asked questions")) {
      out.hasFaqHeading = true;
    }
  }

  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    out.jsonLdBlocks++;
    try {
      collectTypes(JSON.parse(m[1]), out.jsonLdTypes);
    } catch {
      // Unparseable JSON-LD: block exists but yields no types. Counted as a
      // block; the type-based checks below will treat missing types as gaps.
    }
  }

  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    if (a.href) {
      out.anchorHrefs.push(a.href);
      out.allTargets.push(a.href);
    }
  }
  for (const m of html.matchAll(/<(?:script|img|source|video|audio|iframe|embed)\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    if (a.src) out.allTargets.push(a.src);
    if (a.href) out.allTargets.push(a.href);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Sitemap discovery
// ---------------------------------------------------------------------------

async function fetchSitemapUrls() {
  const start = new URL("/sitemap.xml", BASE).href;
  const seen = new Set();
  const pageUrls = [];
  const queue = [start];
  while (queue.length) {
    const smUrl = queue.shift();
    if (seen.has(smUrl)) continue;
    seen.add(smUrl);
    const res = await fetchRaw(smUrl, { wantBody: true });
    if (!res.ok || res.status !== 200 || !res.text) {
      console.error(`[crawler] sitemap fetch failed: ${smUrl} -> ${res.status || res.error}`);
      continue;
    }
    const locs = [...res.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
    const isIndex = /<sitemapindex[\s>]/i.test(res.text);
    for (const loc of locs) {
      let u;
      try { u = new URL(loc); } catch { continue; }
      if (isIndex) {
        // Child sitemap: fetch it from the crawl base so previews work.
        queue.push(new URL(u.pathname + u.search, BASE).href);
      } else if (isInternal(u)) {
        // Rewrite the origin onto the crawl base (deploy previews, local
        // builds) while keeping the sitemap's paths.
        pageUrls.push(new URL(u.pathname + u.search, BASE).href);
      }
    }
  }
  return pageUrls;
}

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------

const pagesByKey = new Map();      // final pageKey -> record
const requestedToFinal = new Map(); // requested pageKey -> final pageKey
const targetRefs = new Map();       // targetKey -> { fetchUrl, linkedFrom: Set<finalPageKey> }
let truncated = false;

function noteTarget(rawHref, fromKey, baseForResolve) {
  let u;
  try { u = new URL(rawHref, baseForResolve); } catch { return; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return;
  if (!isInternal(u)) return;
  u.hash = "";
  const key = targetKey(u);
  if (!targetRefs.has(key)) targetRefs.set(key, { fetchUrl: u.href, linkedFrom: new Set() });
  if (fromKey) targetRefs.get(key).linkedFrom.add(fromKey);
}

async function crawl(seedUrls) {
  const queue = [];
  const queued = new Set();
  const enqueue = (url, isSeed = false) => {
    let u;
    try { u = new URL(url); } catch { return; }
    u.hash = "";
    const key = pageKey(u);
    if (queued.has(key)) return;
    if (pagesByKey.size + queue.length >= args.maxPages && !isSeed) {
      truncated = true;
      return;
    }
    queued.add(key);
    queue.push({ url: u.href, key, isSeed });
  };

  for (const u of seedUrls) enqueue(u, true);

  let active = 0;
  await new Promise((resolve) => {
    const pump = () => {
      while (active < args.concurrency && queue.length) {
        const item = queue.shift();
        active++;
        processPage(item, enqueue).finally(() => {
          active--;
          if (!queue.length && active === 0) resolve();
          else pump();
        });
      }
      if (!queue.length && active === 0) resolve();
    };
    pump();
  });
}

async function processPage({ url, key, isSeed }, enqueue) {
  const res = await fetchRaw(url, { wantBody: true });
  let finalKey = key;
  let finalUrl = url;
  if (res.ok && res.finalUrl) {
    try {
      const fu = new URL(res.finalUrl);
      if (isInternal(fu)) {
        finalUrl = fu.href;
        finalKey = pageKey(fu);
      }
    } catch { /* keep requested identity */ }
  }
  requestedToFinal.set(key, finalKey);
  if (pagesByKey.has(finalKey)) return;

  const isHtml = /text\/html|application\/xhtml/i.test(res.contentType || "");
  const record = {
    key: finalKey,
    url: finalUrl,
    requestedUrl: url,
    isSeed,
    status: res.ok ? res.status : 0,
    fetchError: res.ok ? null : res.error || "fetch failed",
    isHtml,
    parsed: null,
  };
  pagesByKey.set(finalKey, record);
  if (!res.ok || !isHtml || !res.text) return;

  const parsed = parsePage(res.text);
  record.parsed = parsed;

  const robotsTokens = `${parsed.robotsMeta} ${res.xRobotsTag.toLowerCase()}`;
  record.noindex = /\bnoindex\b/.test(robotsTokens);
  record.nofollow = /\bnofollow\b/.test(robotsTokens);
  record.xRobotsTag = res.xRobotsTag || "";

  // Link targets (broken-link check) — resolved against the final URL.
  for (const t of parsed.allTargets) noteTarget(t, finalKey, finalUrl);

  // Page discovery: follow internal <a href> only, skip assets and /api.
  for (const href of parsed.anchorHrefs) {
    let u;
    try { u = new URL(href, finalUrl); } catch { continue; }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    if (!isInternal(u)) continue;
    const p = u.pathname;
    if (p.startsWith("/api/") || p === "/api") continue;
    if (ASSET_EXTENSIONS.has(extOf(p))) continue;
    enqueue(u.href);
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function classify(p) {
  const types = new Set();
  if (/^\/blog\/.+/.test(p) || /^\/guides\/.+/.test(p)) types.add("article");
  if (p === "/store" || p === "/cart" || p.startsWith("/store/") || p.startsWith("/products/")) types.add("product");
  if (p === "/locations" || p.startsWith("/locations/") || p === "/trades" || p.startsWith("/trades/")) types.add("landing");
  if (
    p === "/services" || p.startsWith("/services/") ||
    /(^|\/)(website-design|web-design|website-redesign|seo-ready-websites|website-monitoring|packages|for-local-service-businesses)(\/|$)/.test(p) ||
    /website-design|web-design/.test(p)
  ) types.add("service");
  return types;
}

function runChecks(sitemapKeys) {
  const findings = {
    brokenLinks: [], // { target, status, error, linkedFrom[] }
    schema: [],      // { page, rule, detail }
    visibility: [],  // { page, rule, detail }
    basics: [],      // { page, rule, detail }
  };
  const warnings = []; // non-gating observations (noindex bulk pages)
  const pages = [...pagesByKey.values()];

  // Canonical aliases: a page whose canonical points at a different internal
  // page is a serving variant of that page (e.g. FlipRadar's extensionless
  // city URLs canonicalize to the .html form). Aliases are not independent
  // pages for title/sitemap/schema purposes.
  for (const pg of pages) {
    pg.inSitemap = sitemapKeys.has(pg.key);
    pg.path = new URL(pg.url).pathname.replace(/\/+$/, "") || "/";
    pg.utility = isUtilityPath(pg.path);
    pg.aliasOf = null;
    if (pg.parsed && pg.parsed.canonical) {
      try {
        const cu = new URL(pg.parsed.canonical, pg.url);
        if (isInternal(cu)) {
          const ck = pageKey(cu);
          if (ck !== pg.key) pg.aliasOf = ck;
        }
      } catch { /* ignore */ }
    }
  }

  // ---- Duplicate titles (all real pages, aliases excluded) ----
  const byTitle = new Map();
  for (const pg of pages) {
    if (!pg.parsed || !pg.parsed.title || pg.aliasOf) continue;
    if (!byTitle.has(pg.parsed.title)) byTitle.set(pg.parsed.title, []);
    byTitle.get(pg.parsed.title).push(pg.url);
  }
  for (const [title, urls] of byTitle) {
    if (urls.length > 1) {
      findings.visibility.push({
        page: urls.join(", "),
        rule: "duplicate-title",
        detail: `${urls.length} pages share the title "${title}"`,
      });
    }
  }

  // ---- Bulk noindex location pages: warnings (evaluated before the alias
  // skip — a canonical alias serves byte-identical content, so its own
  // parsed schema is the schema its canonical twin would be judged by).
  const warnedBulk = new Set();
  for (const pg of pages) {
    if (!pg.parsed || pg.status !== 200) continue;
    if (!(isBulkLocation(pg.path, pg.inSitemap) && pg.noindex)) continue;
    const dedupeKey = pg.aliasOf || pg.key;
    if (warnedBulk.has(dedupeKey)) continue;
    warnedBulk.add(dedupeKey);
    const types = pg.parsed.jsonLdTypes;
    const misses = [];
    if (!types.has("LocalBusiness") && !types.has("Organization")) misses.push("LocalBusiness/Organization");
    if (!types.has("BreadcrumbList")) misses.push("BreadcrumbList");
    if (misses.length) {
      warnings.push({ page: pg.url, rule: "bulk-page-schema-if-promoted", detail: `noindex bulk page would miss: ${misses.join(", ")}` });
    }
  }

  for (const pg of pages) {
    if (pg.aliasOf) continue;
    const p = pg.path;
    const bulk = isBulkLocation(p, pg.inSitemap) && pg.noindex;
    const indexable = !pg.noindex;
    // Schema expectations apply to every content page — including wrongly
    // noindexed ones (the /store case: noindex AND zero schema). Utility
    // routes and deliberately-noindex bulk pages are exempt.
    const schemaChecked = !pg.utility && !bulk;

    // ---- Basics (content pages; utility pages are status-checked via links) ----
    if (!pg.utility) {
      if (pg.status !== 200) {
        findings.basics.push({ page: pg.url, rule: "non-200", detail: pg.fetchError ? `fetch error: ${pg.fetchError}` : `HTTP ${pg.status}` });
      } else if (pg.parsed) {
        if (!pg.parsed.title) findings.basics.push({ page: pg.url, rule: "missing-title", detail: "no <title> tag" });
        if (!pg.parsed.metaDescription) findings.basics.push({ page: pg.url, rule: "missing-meta-description", detail: "no meta description" });
        if (pg.parsed.h1Count !== 1) findings.basics.push({ page: pg.url, rule: "h1-count", detail: `${pg.parsed.h1Count} <h1> elements` });
      }
    }

    // ---- Visibility ----
    if (!pg.utility && !bulk && (pg.noindex || pg.nofollow)) {
      const bits = [pg.noindex && "noindex", pg.nofollow && "nofollow"].filter(Boolean).join(", ");
      findings.visibility.push({ page: pg.url, rule: "unexpected-noindex", detail: `robots: ${bits}${pg.xRobotsTag ? " (incl. X-Robots-Tag header)" : ""}` });
    }
    if (!pg.utility && pg.status === 200 && (indexable || pg.inSitemap || p === "/store")) {
      if (pg.parsed && !pg.parsed.canonical) {
        findings.visibility.push({ page: pg.url, rule: "missing-canonical", detail: "no <link rel=\"canonical\">" });
      }
    }
    if (indexable && !pg.utility && !pg.inSitemap && pg.status === 200) {
      findings.visibility.push({ page: pg.url, rule: "missing-from-sitemap", detail: "indexable page is not in the sitemap" });
    }

    // ---- Schema ----
    if (pg.parsed && pg.status === 200) {
      const types = pg.parsed.jsonLdTypes;
      const classes = classify(p);

      if (!bulk && schemaChecked) {
        if (pg.parsed.jsonLdBlocks === 0) {
          findings.schema.push({ page: pg.url, rule: "zero-schema", detail: "no JSON-LD blocks at all" });
        }
        if (classes.has("article") && !types.has("BlogPosting") && !types.has("Article")) {
          findings.schema.push({ page: pg.url, rule: "missing-article-schema", detail: "article page without BlogPosting/Article schema" });
        }
        if (pg.parsed.hasFaqHeading && !types.has("FAQPage")) {
          findings.schema.push({ page: pg.url, rule: "missing-faq-schema", detail: "visible FAQ section (FAQ heading) without FAQPage schema" });
        }
        if (classes.has("product")) {
          if (!types.has("Product")) {
            findings.schema.push({ page: pg.url, rule: "missing-product-schema", detail: "store/product page without Product schema" });
          } else if (!types.has("Offer")) {
            findings.schema.push({ page: pg.url, rule: "product-without-offer", detail: "Product schema present but no Offer" });
          }
        }
        if (classes.has("landing")) {
          if (!types.has("LocalBusiness") && !types.has("Organization")) {
            findings.schema.push({ page: pg.url, rule: "missing-entity-schema", detail: "location/landing page without LocalBusiness or Organization schema" });
          }
          if (!types.has("BreadcrumbList")) {
            findings.schema.push({ page: pg.url, rule: "missing-breadcrumb-schema", detail: "location/landing page without BreadcrumbList schema" });
          }
        }
        if (classes.has("service") && !types.has("Service")) {
          findings.schema.push({ page: pg.url, rule: "missing-service-schema", detail: "service page without Service schema" });
        }
      }
    }
  }

  return { findings, warnings };
}

async function checkBrokenLinks() {
  const results = [];
  const targets = [...targetRefs.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .filter((t) => {
      const p = new URL(t.fetchUrl).pathname;
      return !(p === "/api" || p.startsWith("/api/")); // API endpoints are not page links; GET semantics differ
    });

  await pool(targets, args.concurrency, async (t) => {
    // Reuse the crawl result when the target is a crawled page.
    const asPage = requestedToFinal.get(t.key) || (pagesByKey.has(t.key) ? t.key : null);
    let status;
    let error = null;
    if (asPage && pagesByKey.has(asPage)) {
      status = pagesByKey.get(asPage).status;
      error = pagesByKey.get(asPage).fetchError;
    } else {
      const res = await fetchRaw(t.fetchUrl, { wantBody: false });
      status = res.ok ? res.status : 0;
      error = res.ok ? null : res.error || "fetch failed";
    }
    if (status !== 200) {
      results.push({
        target: t.fetchUrl,
        status,
        error,
        linkedFrom: [...t.linkedFrom].map((k) => (pagesByKey.get(k) ? pagesByKey.get(k).url : k)),
      });
    }
  });

  results.sort((a, b) => a.target.localeCompare(b.target));
  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function groupByRule(findings) {
  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.rule)) groups.set(f.rule, []);
    groups.get(f.rule).push(f);
  }
  return groups;
}

function renderMd(report) {
  const lines = [];
  const v = report.verdict;
  lines.push(`# Internal Crawler Report`);
  lines.push("");
  lines.push(`- **Base:** ${report.base}`);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Pages crawled:** ${report.summary.pagesCrawled} (${report.summary.pagesInSitemap} from sitemap, ${report.summary.pagesDiscovered} via internal links)`);
  lines.push(`- **Link targets checked:** ${report.summary.linkTargetsChecked}`);
  if (report.summary.truncated) lines.push(`- **Note:** page cap (${report.summary.maxPages}) reached — crawl was truncated.`);
  lines.push("");
  lines.push(`## Verdict: ${v.overall}`);
  lines.push("");
  lines.push(`| Category | Verdict | Findings |`);
  lines.push(`|---|---|---|`);
  for (const [name, c] of Object.entries(report.categories)) {
    lines.push(`| ${name} | ${c.verdict} | ${c.findings.length} |`);
  }
  lines.push("");

  const bl = report.categories["broken-links"].findings;
  lines.push(`## Broken links (${bl.length})`);
  lines.push("");
  if (!bl.length) lines.push("None.");
  for (const f of bl) {
    lines.push(`- \`${f.target}\` -> ${f.error ? `fetch error (${f.error})` : `HTTP ${f.status}`}`);
    const from = f.linkedFrom.slice(0, 10);
    for (const src of from) lines.push(`  - linked from: ${src}`);
    if (f.linkedFrom.length > from.length) lines.push(`  - ...and ${f.linkedFrom.length - from.length} more pages`);
  }
  lines.push("");

  for (const catName of ["schema", "visibility", "basics"]) {
    const cat = report.categories[catName];
    lines.push(`## ${catName[0].toUpperCase() + catName.slice(1)} (${cat.findings.length})`);
    lines.push("");
    if (!cat.findings.length) lines.push("None.");
    for (const [rule, items] of groupByRule(cat.findings)) {
      lines.push(`### ${rule} (${items.length})`);
      for (const f of items) lines.push(`- ${f.page} — ${f.detail}`);
      lines.push("");
    }
  }

  if (report.warnings.length) {
    lines.push(`## Warnings — not gating (${report.warnings.length})`);
    lines.push("");
    const byRule = groupByRule(report.warnings);
    for (const [rule, items] of byRule) {
      lines.push(`### ${rule} (${items.length})`);
      for (const f of items.slice(0, 25)) lines.push(`- ${f.page} — ${f.detail}`);
      if (items.length > 25) lines.push(`- ...and ${items.length - 25} more (see report.json)`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  console.error(`[crawler] base=${BASE.href} maxPages=${args.maxPages} concurrency=${args.concurrency}`);

  const sitemapUrls = await fetchSitemapUrls();
  const sitemapKeys = new Set(sitemapUrls.map((u) => pageKey(new URL(u))));
  console.error(`[crawler] sitemap URLs: ${sitemapUrls.length}`);

  const seeds = [BASE.href, ...sitemapUrls, ...SEED_PATHS.map((p) => new URL(p, BASE).href)];
  await crawl(seeds);
  console.error(`[crawler] pages crawled: ${pagesByKey.size}`);

  // Drop seeds that don't exist on this site (non-200, not in sitemap,
  // not linked from anywhere) — e.g. /store on a site with no store.
  for (const [key, rec] of [...pagesByKey.entries()]) {
    if (!rec.isSeed || rec.status === 200) continue;
    const linked = [...targetRefs.values()].some((t) => t.linkedFrom.size > 0 && t.fetchUrl && pageKey(new URL(t.fetchUrl)) === key);
    if (!sitemapKeys.has(key) && !linked) {
      pagesByKey.delete(key);
      console.error(`[crawler] ignoring nonexistent seed: ${rec.requestedUrl} (HTTP ${rec.status})`);
    }
  }

  const { findings, warnings } = runChecks(sitemapKeys);
  findings.brokenLinks = await checkBrokenLinks();

  const categories = {
    "broken-links": { verdict: findings.brokenLinks.length ? "FAIL" : "PASS", findings: findings.brokenLinks },
    schema: { verdict: findings.schema.length ? "FAIL" : "PASS", findings: findings.schema },
    visibility: { verdict: findings.visibility.length ? "FAIL" : "PASS", findings: findings.visibility },
    basics: { verdict: findings.basics.length ? "FAIL" : "PASS", findings: findings.basics },
  };
  const overall = Object.values(categories).some((c) => c.verdict === "FAIL") ? "FAIL" : "PASS";

  const inSitemapCount = [...pagesByKey.values()].filter((p) => sitemapKeys.has(p.key)).length;
  const report = {
    base: BASE.href,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    summary: {
      pagesCrawled: pagesByKey.size,
      pagesInSitemap: inSitemapCount,
      pagesDiscovered: pagesByKey.size - inSitemapCount,
      linkTargetsChecked: targetRefs.size,
      maxPages: args.maxPages,
      truncated,
    },
    verdict: { overall, categories: Object.fromEntries(Object.entries(categories).map(([k, c]) => [k, c.verdict])) },
    categories,
    warnings,
    pages: [...pagesByKey.values()].map((p) => ({
      url: p.url,
      status: p.status,
      inSitemap: sitemapKeys.has(p.key),
      noindex: !!p.noindex,
      nofollow: !!p.nofollow,
      xRobotsTag: p.xRobotsTag || undefined,
      aliasOf: p.aliasOf || undefined,
      title: p.parsed ? p.parsed.title : null,
      canonical: p.parsed ? p.parsed.canonical : null,
      h1Count: p.parsed ? p.parsed.h1Count : null,
      jsonLdTypes: p.parsed ? [...p.parsed.jsonLdTypes].sort() : [],
    })),
  };

  await mkdir(args.out, { recursive: true });
  await writeFile(path.join(args.out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(args.out, "report.md"), renderMd(report));

  console.log(`\nInternal crawler — ${BASE.href}`);
  console.log(`Pages crawled: ${report.summary.pagesCrawled} | link targets checked: ${report.summary.linkTargetsChecked}`);
  for (const [name, c] of Object.entries(categories)) {
    console.log(`  ${name.padEnd(14)} ${c.verdict} (${c.findings.length} findings)`);
  }
  if (warnings.length) console.log(`  warnings       ${warnings.length} (non-gating; see report)`);
  console.log(`Reports: ${path.join(args.out, "report.md")} / report.json`);
  console.log(`VERDICT: ${overall}`);

  process.exitCode = overall === "FAIL" ? 1 : 0;
}

main().catch((err) => {
  console.error("[crawler] fatal:", err);
  process.exitCode = 2;
});
