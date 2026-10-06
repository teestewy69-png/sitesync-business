/**
 * Local SEO audit adapter: crawls a customer site with the factory page parser (lib/factory/crawl.ts
 * parsePage) over an SSRF-safe fetcher, same-origin only, capped at SEO_AUDIT_PAGE_LIMIT pages.
 */
import { parsePage } from "@/lib/factory/crawl";
import type { PageAudit } from "@/lib/factory/types";
import { esc, reportDocument } from "../html";
import { assertSafeUrl, safeFetchText, UnsafeUrlError } from "../safe-fetch";
import { NonRetryableError } from "./errors";

export const SEO_AUDIT_PAGE_LIMIT = 15;
const CRAWL_BUDGET_MS = 45_000;

type Issue = { severity: "high" | "medium" | "low"; page: string; issue: string; fix: string };

function sameOrigin(origin: string, href: string): boolean {
  try {
    return new URL(href).origin === origin;
  } catch {
    return false;
  }
}

function normalizePath(href: string): string | null {
  try {
    const u = new URL(href);
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|css|js|xml|txt|ico)$/i.test(u.pathname)) return null;
    return `${u.pathname || "/"}${u.search}`;
  } catch {
    return null;
  }
}

export type CrawlResult = { origin: string; pages: PageAudit[]; robotsOk: boolean; sitemapOk: boolean; https: boolean };

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
  const startPath = normalizePath(first.finalUrl) || "/";
  const pages: PageAudit[] = [parsePage(origin, startPath, first)];
  const seen = new Set<string>([startPath]);
  const queue: string[] = [];
  const enqueue = (page: PageAudit) => {
    for (const href of page.internalLinks) {
      if (!sameOrigin(origin, href)) continue;
      const p = normalizePath(href.split("#")[0]);
      if (p && !seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
    }
  };
  enqueue(pages[0]);
  const deadline = Date.now() + CRAWL_BUDGET_MS;
  while (queue.length && pages.length < maxPages && Date.now() < deadline) {
    const p = queue.shift()!;
    const fetched = await safeFetchText(`${origin}${p}`);
    if (fetched.ok && new URL(fetched.finalUrl).origin !== origin) continue;
    if (fetched.contentType && !/html/i.test(fetched.contentType)) continue;
    const page = parsePage(origin, p, fetched);
    pages.push(page);
    if (fetched.ok) enqueue(page);
  }
  const [robots, sitemap] = await Promise.all([
    safeFetchText(`${origin}/robots.txt`, { maxBytes: 200_000 }),
    safeFetchText(`${origin}/sitemap.xml`, { maxBytes: 500_000 }),
  ]);
  return { origin, pages, robotsOk: robots.ok, sitemapOk: sitemap.ok && /<urlset|<sitemapindex/i.test(sitemap.body), https: origin.startsWith("https:") };
}

export function auditIssues(result: CrawlResult): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Issue["severity"], page: string, issue: string, fix: string) => issues.push({ severity, page, issue, fix });
  if (!result.https) add("high", "site", "The site is served over plain HTTP.", "Serve every page over HTTPS and redirect HTTP to HTTPS.");
  if (!result.sitemapOk) add("medium", "site", "No XML sitemap at /sitemap.xml.", "Publish a sitemap listing your real pages and reference it in robots.txt.");
  if (!result.robotsOk) add("low", "site", "No robots.txt file.", "Add a robots.txt that allows crawling and points to the sitemap.");

  const titles = new Map<string, string[]>();
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
    else if (p.metaDescription.length > 170) add("low", at, "Meta description is long and will be truncated.", "Trim it to about 160 characters.");
    if (p.headings.h1.length === 0) add("medium", at, "No H1 heading.", "Give the page one H1 that says what it is about.");
    if (p.headings.h1.length > 1) add("low", at, `${p.headings.h1.length} H1 headings.`, "Use a single H1; demote the rest to H2.");
    if (!p.canonical) add("low", at, "No canonical link.", "Add a self-referencing canonical URL.");
    if (p.missingAlt > 0) add("low", at, `${p.missingAlt} image(s) without alt text.`, "Describe each meaningful image in its alt attribute.");
    if (p.wordCount < 250) add("low", at, `Thin content (${p.wordCount} words).`, "Explain the service, area, prices or process in more depth.");
    if (!p.ogTitle || !p.ogImage) add("low", at, "Missing Open Graph title/image.", "Add og:title and og:image so shared links look right.");
  }
  for (const [title, paths] of titles) {
    if (paths.length > 1) add("medium", paths.join(", "), `Duplicate title "${title.slice(0, 60)}".`, "Give every page its own title.");
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
  const order = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export async function generateSeoAuditReport(input: { siteUrl?: string }): Promise<string> {
  if (!input.siteUrl) throw new NonRetryableError("SEO audit needs the website address.");
  const result = await crawlSite(input.siteUrl);
  const issues = auditIssues(result);
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
  const body = `<h1>Local SEO audit: ${esc(result.origin)}</h1>
<p class="muted">Crawled ${result.pages.length} page(s) (limit ${SEO_AUDIT_PAGE_LIMIT}) on ${esc(new Date().toUTCString())}.</p>
<p><strong>${counts.high}</strong> high, <strong>${counts.medium}</strong> medium and <strong>${counts.low}</strong> low priority findings.</p>
<h2>Findings and fixes</h2>
${issues.length ? `<table><thead><tr><th>Priority</th><th>Where</th><th>Finding</th><th>Fix</th></tr></thead><tbody>${issueRows}</tbody></table>` : "<p>No on-page issues found in the crawled pages.</p>"}
<h2>Pages crawled</h2>
<table><thead><tr><th>Path</th><th>HTTP</th><th>Title</th><th>H1s</th><th>Words</th><th>Images w/o alt</th></tr></thead><tbody>${pageRows}</tbody></table>
<h2>What this report is (and is not)</h2>
<p>An automated on-page snapshot of the pages above: titles, descriptions, headings, canonicals, image text, structured data and contact paths. It does not measure rankings, backlinks, Google Business Profile or reviews, and no audit can guarantee rankings or traffic.</p>`;
  return reportDocument(`Local SEO audit: ${result.origin}`, body);
}
