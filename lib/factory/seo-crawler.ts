/**
 * The SEO department's crawler (added 2026-11-20, Firecrawl concept: fetch -> clean
 * extraction -> structured records).
 *
 * Why this exists: the baseline pipeline's original crawler (lib/factory/crawl.ts) fetched
 * with a private, unguarded fetch (no SSRF protection, no byte cap, 8s hard timeout) and
 * extracted with regexes whose word counts included nav/footer boilerplate. This crawler:
 *
 *   - fetches through safeFetchText (SSRF-guarded, redirect-validated, byte-capped),
 *   - discovers pages the same way the factory always has (seeds + sitemap.xml + internal
 *     links, robots.txt disallows honored, per-group caps) via crawl-discovery,
 *   - extracts a clean PageAudit record PLUS the page's main text with boilerplate
 *     (nav/header/footer/aside/script/style) stripped — wordCount and excerpt are computed
 *     from that clean text, so SEO numbers describe the content, not the chrome.
 *
 * captureBaseline() runs on this crawler; its snapshot shape is unchanged (the extra
 * mainText field is stripped before a page enters a snapshot). Page-level failures are
 * recorded, never thrown; only an unsafe/invalid origin throws.
 */
import { assertSafeUrl, safeFetchText, type SafeFetchResult } from "@/lib/siteflow/safe-fetch";
import { crawlablePath, enqueue, newDiscovery, robotsDisallows } from "./crawl-discovery";
import type { PageAudit } from "./types";

export type SeoCrawlFetcher = (url: string) => Promise<SafeFetchResult>;

/** A PageAudit plus the Firecrawl-style extraction: clean main text, boilerplate stripped. */
export type SeoCrawlPage = PageAudit & { mainText: string };

export type SeoCrawlResult = {
  origin: string;
  pages: SeoCrawlPage[];
  /** Pages that could not be fetched at all (network/SSRF), with the reason. */
  failures: { url: string; error: string }[];
  /** True when the page budget or time budget stopped the crawl early. */
  truncated: boolean;
};

export const SEO_CRAWL_DEFAULT_MAX_PAGES = 30;
export const SEO_CRAWL_DEFAULT_BUDGET_MS = 60_000;
const MAIN_TEXT_CAP = 4000;

const defaultFetcher: SeoCrawlFetcher = (url) =>
  safeFetchText(url, { timeoutMs: 15_000, maxBytes: 3_000_000 });

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Visible main text: scripts/styles and site chrome (nav/header/footer/aside) removed. */
export function mainTextOf(html: string): string {
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0];
  const scope = main || /<body\b[\s\S]*?<\/body>/i.exec(html)?.[0] || html;
  const cleaned = scope
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");
  return stripTags(cleaned);
}

function attr(tag: string, name: string): string {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return m ? decodeEntities(m[1]) : "";
}

/** Meta content by name/property, tolerant of attribute order (the old crawler was not). */
function metaContent(html: string, key: string, by: "name" | "property"): string {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (attr(tag, by).toLowerCase() === key.toLowerCase()) return attr(tag, "content");
  }
  return "";
}

function collectText(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = stripTags(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function schemaTypesOf(html: string): string[] {
  const types: string[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const json = JSON.parse(m[1]);
      const walk = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        const rec = node as Record<string, unknown>;
        const t = rec["@type"];
        if (typeof t === "string") types.push(t);
        if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === "string"));
        if (Array.isArray(rec["@graph"])) rec["@graph"].forEach(walk);
      };
      (Array.isArray(json) ? json : [json]).forEach(walk);
    } catch {
      types.push("InvalidJSON-LD");
    }
  }
  return [...new Set(types)];
}

function extractPage(origin: string, pathName: string, fetched: SafeFetchResult): SeoCrawlPage {
  const url = `${origin}${pathName}`;
  if (!fetched.ok || !fetched.body) {
    return {
      url, path: pathName, statusCode: fetched.status || null,
      title: "", metaDescription: "", canonical: "", robots: "", wordCount: 0,
      headings: { h1: [], h2: [], h3: [] }, schemaTypes: [], ogTitle: "", ogDescription: "",
      ogImage: "", images: [], missingAlt: 0, internalLinks: [], externalLinks: [], forms: [],
      ttfbMs: fetched.ok ? fetched.ttfbMs : null, bytes: fetched.ok ? fetched.bytes : null,
      error: fetched.error || `HTTP ${fetched.status}`, excerpt: "", mainText: "",
    };
  }
  const html = fetched.body;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: attr(m[0], "src"),
    alt: attr(m[0], "alt"),
  }));
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((m) => {
    try {
      return new URL(decodeEntities(m[1]), origin).toString();
    } catch {
      return "";
    }
  }).filter(Boolean);
  const sameOrigin = (href: string): boolean => {
    try {
      return new URL(href).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  };
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((m) => {
    const tag = m[0];
    const fields = [...tag.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].map(
      (f) => attr(f[0], "name") || attr(f[0], "type") || f[1]
    );
    return {
      action: attr(tag, "action") || pathName,
      method: (attr(tag, "method") || "get").toLowerCase(),
      fields: fields.filter(Boolean),
    };
  });
  const mainText = mainTextOf(html);
  const canonicalTag = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [""])[0];
  return {
    url,
    path: pathName,
    statusCode: fetched.status || null,
    title: stripTags((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || ["", ""])[1]),
    metaDescription: metaContent(html, "description", "name"),
    canonical: attr(canonicalTag, "href"),
    robots: metaContent(html, "robots", "name"),
    wordCount: mainText.split(/\s+/).filter(Boolean).length,
    headings: { h1: collectText(html, "h1"), h2: collectText(html, "h2"), h3: collectText(html, "h3") },
    schemaTypes: schemaTypesOf(html),
    ogTitle: metaContent(html, "og:title", "property"),
    ogDescription: metaContent(html, "og:description", "property"),
    ogImage: metaContent(html, "og:image", "property"),
    images,
    missingAlt: images.filter((img) => !img.alt.trim()).length,
    internalLinks: [...new Set(anchors.filter(sameOrigin))],
    externalLinks: [...new Set(anchors.filter((href) => !sameOrigin(href)))],
    forms,
    ttfbMs: fetched.ttfbMs,
    bytes: fetched.bytes,
    error: "",
    excerpt: mainText.slice(0, 600),
    mainText: mainText.slice(0, MAIN_TEXT_CAP),
  };
}

function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

/**
 * Crawl a site for the SEO department. Seeds are always fetched; with `discover` on
 * (default), sitemap entries and internal links are followed under the robots rules and
 * the page/time budgets. Pass pre-fetched robotsTxt/sitemapUrls to avoid refetching them
 * (captureBaseline already has both in hand for its snapshot).
 */
export async function crawlSiteForSeo(
  rawOrigin: string,
  opts?: {
    seeds?: string[];
    discover?: boolean;
    maxPages?: number;
    budgetMs?: number;
    robotsTxt?: string;
    sitemapUrls?: string[];
    fetcher?: SeoCrawlFetcher;
  }
): Promise<SeoCrawlResult> {
  const origin = assertSafeUrl(rawOrigin).origin;
  const fetcher = opts?.fetcher || defaultFetcher;
  const discover = opts?.discover ?? true;
  const maxPages = Math.max(1, Math.min(opts?.maxPages || SEO_CRAWL_DEFAULT_MAX_PAGES, 200));
  const budgetMs = Math.max(1_000, Math.min(opts?.budgetMs || SEO_CRAWL_DEFAULT_BUDGET_MS, 300_000));

  let robotsTxt = opts?.robotsTxt;
  if (robotsTxt === undefined) {
    const robots = await fetcher(`${origin}/robots.txt`).catch(() => null);
    robotsTxt = robots?.ok ? robots.body : "";
  }
  let sitemapList = opts?.sitemapUrls;
  if (sitemapList === undefined) {
    const sitemap = await fetcher(`${origin}/sitemap.xml`).catch(() => null);
    sitemapList = sitemap?.ok ? sitemapUrls(sitemap.body) : [];
  }
  const disallow = robotsTxt ? robotsDisallows(robotsTxt) : [];
  // The budget clock starts AFTER robots/sitemap are in hand: on a slow network those two
  // fetches can eat the whole budget and the crawl would return zero pages (seen live
  // 2026-11-20). They degrade gracefully on failure; they must not starve the crawl.
  const started = Date.now();

  const seeds = [...new Set((opts?.seeds?.length ? opts.seeds : ["/"]).map((p) => (p.startsWith("/") ? p : `/${p}`)))];
  const queue = newDiscovery(seeds);
  if (discover) for (const loc of sitemapList) enqueue(queue, crawlablePath(origin, loc), 3, disallow);

  const pages: SeoCrawlPage[] = [];
  const failures: { url: string; error: string }[] = [];
  let truncated = false;

  while (queue.queue.length) {
    if (pages.length >= maxPages || Date.now() - started > budgetMs) {
      truncated = true;
      break;
    }
    const pathName = queue.queue.shift()!;
    let fetched: SafeFetchResult;
    try {
      fetched = await fetcher(`${origin}${pathName === "/" ? "" : pathName}`);
    } catch (err) {
      failures.push({ url: `${origin}${pathName}`, error: err instanceof Error ? err.message : "Fetch failed" });
      continue;
    }
    const page = extractPage(origin, pathName, fetched);
    page.discoveredVia = seeds.includes(pathName)
      ? "seed"
      : sitemapList.some((loc) => crawlablePath(origin, loc) === pathName)
        ? "sitemap"
        : "link";
    pages.push(page);
    if (discover && fetched.ok) {
      for (const href of page.internalLinks) enqueue(queue, crawlablePath(origin, href), 3, disallow);
    }
  }

  return { origin, pages, failures, truncated };
}
