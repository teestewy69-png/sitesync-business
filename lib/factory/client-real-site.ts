/**
 * Build the client factory plan from the client's REAL site (pure, no network, no "@/" imports so tests can load it).
 *
 * Before this, every client got the same template blueprint (home/services/about/contact) and filler drafts
 * ("X focuses on X. Who this helps in the service area ..."), even when the client already had a working site
 * with different pages. Now a reference crawl of the real origin drives the blueprint, and each draft is grounded
 * in what is actually on that page plus concrete SEO fixes measured by the crawl.
 */
import type { BaselineSnapshot, BlueprintPage, FactoryPage, PageAudit } from "./types";

/** Sitesinc's own addresses must never show up as the client's contact details. */
export function isSitesincAddress(email: string): boolean {
  return /@(?:[a-z0-9-]+\.)*sitesinc\.co$/i.test(String(email || "").trim());
}

export function clientFacingEmail(email: string | undefined): string {
  const value = String(email || "").trim();
  return value && !isSitesincAddress(value) ? value : "";
}

export function slugFromPath(path: string): string {
  if (!path || path === "/") return "home";
  return path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 80) || "home";
}

/** Account/utility screens are not content pages; they are audited but never planned as SEO pages. */
export const UTILITY_PATH = /^\/(?:sign-?in|sign-?up|log-?in|log-?out|register|forgot-password|reset-password|account|checkout|cart|auth)(?:\/|$)/i;

/** Pages worth planning: fetched OK, HTML with a title, not noindex, not an account/utility screen. */
export function usableRealPages(snapshot: Pick<BaselineSnapshot, "pageInventory">, max = 25): PageAudit[] {
  return snapshot.pageInventory
    .filter((page) => page.statusCode === 200 && !page.error)
    .filter((page) => !/noindex/i.test(page.robots || ""))
    .filter((page) => !UTILITY_PATH.test(page.path))
    .filter((page) => page.title || page.headings.h1.length)
    .slice(0, max);
}

export type PageSeoFinding = { code: string; detail: string };

/** Concrete, measured fixes for one crawled page. Nothing here is guessed. */
export function seoFindings(page: PageAudit, allPages: PageAudit[] = []): PageSeoFinding[] {
  const out: PageSeoFinding[] = [];
  const title = page.title.trim();
  const meta = page.metaDescription.trim();
  if (!title) out.push({ code: "title_missing", detail: "No <title>." });
  else if (title.length > 60) out.push({ code: "title_long", detail: `Title is ${title.length} characters; Google usually cuts off around 60.` });
  else if (title.length < 15) out.push({ code: "title_short", detail: `Title is only ${title.length} characters.` });
  if (!meta) out.push({ code: "meta_missing", detail: "No meta description." });
  else if (meta.length > 160) out.push({ code: "meta_long", detail: `Meta description is ${meta.length} characters (aim for 120-160).` });
  else if (meta.length < 70) out.push({ code: "meta_short", detail: `Meta description is only ${meta.length} characters (aim for 120-160).` });
  const dupes = allPages.filter((other) => other.path !== page.path && other.title && other.title === page.title);
  if (dupes.length) out.push({ code: "title_duplicate", detail: `Same title as ${dupes.map((d) => d.path).join(", ")}.` });
  const metaDupes = allPages.filter((other) => other.path !== page.path && meta && other.metaDescription === meta);
  if (metaDupes.length) out.push({ code: "meta_duplicate", detail: `Same meta description as ${metaDupes.map((d) => d.path).join(", ")}.` });
  if (page.headings.h1.length === 0) out.push({ code: "h1_missing", detail: "No H1 heading." });
  if (page.headings.h1.length > 1) out.push({ code: "h1_multiple", detail: `${page.headings.h1.length} H1 headings.` });
  if (page.canonical) {
    const norm = (u: string) => u.replace(/\/$/, "");
    if (norm(page.canonical) !== norm(page.url)) {
      out.push({ code: "canonical_mismatch", detail: `Canonical points to ${page.canonical}, not this URL (${page.url}).` });
    }
  } else out.push({ code: "canonical_missing", detail: "No canonical tag." });
  if (!page.ogTitle || !page.ogImage) {
    out.push({ code: "og_incomplete", detail: `Open Graph ${[!page.ogTitle && "og:title", !page.ogImage && "og:image"].filter(Boolean).join(" and ")} missing (link previews on social).` });
  }
  if (page.missingAlt > 0) out.push({ code: "img_alt", detail: `${page.missingAlt} image(s) without alt text.` });
  if (page.wordCount < 300) out.push({ code: "thin", detail: `Only about ${page.wordCount} words of text; thin pages rarely rank.` });
  if (!page.schemaTypes.length) out.push({ code: "schema_missing", detail: "No structured data (JSON-LD)." });
  return out;
}

export function blueprintFromRealPages(pages: PageAudit[]): BlueprintPage[] {
  return pages.map((page) => ({
    slug: slugFromPath(page.path),
    path: page.path,
    title: page.title || page.headings.h1[0] || page.path,
    purpose: page.metaDescription || page.headings.h1[0] || `Existing page ${page.path}`,
    clusterId: page.path === "/" ? "offer" : page.path.split("/").filter(Boolean)[0] || "offer",
    existing: true,
    thinDoorwayRisk: page.wordCount < 300 ? "watched" : "none",
  }));
}

export const REAL_SITE_BANNER =
  "[FACTORY DRAFT - built from a crawl of the client's live site. Existing copy is quoted as-is; SEO fixes are measured, not guessed. Approve before publishing. noindex.]";

/** Draft for one real page: what is there now, what to fix, and what to add - only from crawled facts. */
export function draftFromRealPage(
  page: PageAudit,
  ctx: { businessName: string; capturedAt: string; baselineId: string; allPages?: PageAudit[] }
): Pick<FactoryPage, "title" | "metaDescription" | "headings" | "body"> {
  const findings = seoFindings(page, ctx.allPages || []);
  const h1 = page.headings.h1[0] || "";
  const headings = [...page.headings.h1, ...page.headings.h2].slice(0, 12);
  const lines: string[] = [
    `# ${h1 || page.title}`,
    "",
    `Live URL: ${page.url} (crawled ${ctx.capturedAt.slice(0, 10)}, baseline ${ctx.baselineId}).`,
    "",
    "## What the page says today",
    "",
    page.title ? `Title: ${page.title}` : "Title: (none)",
    page.metaDescription ? `Meta description: ${page.metaDescription}` : "Meta description: (none)",
    `About ${page.wordCount} words. Headings: ${headings.length ? headings.join(" / ") : "(none)"}.`,
    "",
    page.excerpt ? `Opening copy: "${page.excerpt.slice(0, 400)}${page.excerpt.length > 400 ? "…" : ""}"` : "",
    "",
    "## SEO fixes for this page",
    "",
    ...(findings.length ? findings.map((f) => `- ${f.detail}`) : ["- No issues found by the implemented checks."]),
    "",
    "## Content to add",
    "",
    page.wordCount < 300
      ? `- Expand the page (now ~${page.wordCount} words) with what ${ctx.businessName} actually offers here, using the client's own facts.`
      : "- Keep the existing copy; tighten it rather than replacing it.",
    page.headings.h2.length
      ? `- Make sure each section (${page.headings.h2.slice(0, 6).join(", ")}) answers one clear question a visitor would search for.`
      : "- Add H2 sections so search engines and readers can scan the page.",
    "- Only add claims (prices, results, reviews) the client has confirmed.",
  ];
  const body = lines
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();
  return {
    title: page.title || h1 || ctx.businessName,
    metaDescription: page.metaDescription.slice(0, 160),
    headings,
    body,
  };
}

/**
 * Replace template-seeded pages with pages derived from the real site. Operator-supplied copy and anything
 * already approved/published is kept untouched.
 */
export function applyRealSitePlan(
  current: { blueprint: BlueprintPage[]; pages: FactoryPage[] },
  snapshot: Pick<BaselineSnapshot, "pageInventory" | "capturedAt" | "id">,
  ctx: { businessName: string; maxPages?: number }
): { blueprint: BlueprintPage[]; pages: FactoryPage[]; imported: number } {
  const real = usableRealPages(snapshot, ctx.maxPages || 25);
  if (!real.length) return { ...current, imported: 0 };
  const keep = current.pages.filter(
    (page) =>
      page.source === "operator" ||
      page.status === "approved" ||
      page.status === "published"
  );
  const keepPaths = new Set(keep.map((page) => page.path));
  const blueprint = blueprintFromRealPages(real);
  const pages: FactoryPage[] = [...keep];
  for (const page of real) {
    if (keepPaths.has(page.path)) continue;
    const draft = draftFromRealPage(page, {
      businessName: ctx.businessName,
      capturedAt: snapshot.capturedAt,
      baselineId: snapshot.id,
      allPages: real,
    });
    const body = `${REAL_SITE_BANNER}\n\n${draft.body}`;
    pages.push({
      slug: slugFromPath(page.path),
      path: page.path,
      title: draft.title,
      metaDescription: draft.metaDescription,
      status: "ready_for_review",
      briefId: `brief-${slugFromPath(page.path)}`,
      wordCount: body.split(/\s+/).filter(Boolean).length,
      headings: draft.headings,
      body,
      noindex: true,
      approvedBy: "",
      approvedAt: "",
      publishedAt: "",
      source: "template",
    });
  }
  return { blueprint, pages, imported: real.length };
}
