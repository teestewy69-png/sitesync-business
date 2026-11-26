import { auditIssues, crawlSite, healthScore, publishedPhones, siteNap } from "@/lib/siteflow/generators/seo-audit";

/**
 * The deep half of the free website audit: the same engine SiteFlow runs for the paid Local SEO
 * Audit Report, pointed at one public site on a request clock. Crawls the whole site (up to 50
 * pages, sitemap-seeded plus link discovery, fetched a few at a time), scores the site 0-100,
 * and returns every distinct finding — a problem repeated on many pages reads once, with the
 * affected-page count and example pages — each carrying a plain-English line on what it means
 * for the owner's business. Read-only; stores nothing.
 */

export type DeepFinding = {
  severity: "high" | "medium" | "low";
  issue: string;
  fix: string;
  /** Plain-English business consequence: what this problem means for the owner's calls and customers. Qualitative only — no invented statistics or figures. */
  consequence: string;
  /** How many crawled pages this finding appeared on (site-level findings count as 1). */
  pages: number;
  firstPage: string;
  /** Up to 3 example page paths the finding appears on (empty for site-level findings). */
  examples: string[];
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

/** Public-route crawl limits: the whole site, inside one serverless invocation's clock. */
export const DEEP_AUDIT_MAX_PAGES = 50;
export const DEEP_AUDIT_BUDGET_MS = 55_000;
export const DEEP_AUDIT_CONCURRENCY = 5;
export const DEEP_AUDIT_FETCH_TIMEOUT_MS = 6_000;

/**
 * What a finding means for the business, in plain English. Matched against the engine's issue
 * texts (which are stable templates). QUALITATIVE ONLY, per the founder's proof standard:
 * no statistics, no percentages, no dollar figures — just what the problem does to the owner's
 * chances of getting the call.
 */
const CONSEQUENCE_RULES: [RegExp, string][] = [
  [/served over plain HTTP/, "Visitors see a \"not secure\" warning before they see your business, and anything they send through the site can be snooped on — many people just leave at the warning."],
  [/blocks every page listed in your sitemap|robots\.txt blocks crawlers/, "Google is being told not to look at the very pages you want to be found for, so those pages can't bring in searches."],
  [/No XML sitemap/, "Search engines have to guess which pages you have, so new and changed pages get found slowly — or missed entirely."],
  [/No robots\.txt/, "Crawlers get no directions on what to index, and your sitemap is harder for them to find."],
  [/Page returns HTTP/, "Anyone who lands on this page — from Google, an ad, or a link someone shared — hits a dead end instead of your business."],
  [/Page could not be fetched/, "If our checker can't load the page, customers and search engines run into the same wall."],
  [/marked noindex/, "This page is invisible in Google search results — even for people searching for exactly what it offers."],
  [/Missing <title>/, "In Google results this page shows up with a blank or made-up title, or doesn't show up at all — so searchers skip past it."],
  [/Title is very short/, "The title doesn't say what you do or where you do it, so the page can't match the searches your customers actually type."],
  [/Title is long/, "Google cuts the title off mid-thought, so the words that would win the click may never be seen."],
  [/Duplicate title/, "Pages sharing one title compete with each other in search, and Google picks which one to show — often not the one you'd choose."],
  [/Missing meta description/, "Google invents the text under your link in search results, and what it invents rarely gives anyone a reason to call."],
  [/Meta description is long/, "The description gets cut off mid-sentence in search results — usually right where the reason to call would be."],
  [/Duplicate meta description/, "Every page reads the same in search results, so none of them speaks to what that particular searcher wants."],
  [/No H1 heading/, "Visitors and Google alike have to guess what the page is about — and both guess worse than they should."],
  [/H1 headings/, "Competing headlines blur what the page is about, for the person reading it and for Google ranking it."],
  [/No canonical/, "If this page can be reached at more than one address, Google may split its ranking strength between the copies."],
  [/without alt text/, "Screen readers can't describe these pictures to blind visitors, and the images can't turn up in image search either."],
  [/Thin content/, "There isn't enough on the page for Google to rank it — or for a visitor to trust you enough to pick up the phone."],
  [/Open Graph/, "When a happy customer shares this page, it appears with no title and no picture — so far fewer people tap it."],
  [/Very heavy page/, "Heavy pages load slowly on phones, and a person stuck waiting on a slow page often just goes back and calls the next business."],
  [/Slow first response/, "A slow server makes every visit start with a wait before anything appears on screen — some visitors don't wait."],
  [/load over plain HTTP on an HTTPS page/, "Browsers may block these images or flag the page as not fully secure, which quietly shakes a visitor's confidence."],
  [/Broken link/, "Visitors who tap that link hit a dead end — and a dead end usually means they leave instead of calling."],
  [/not listed in the sitemap/, "Pages missing from the sitemap are found later by Google — or not at all."],
  [/Orphan page/, "Nobody browsing your site can reach this page, and Google gives it little weight — it may as well not exist."],
  [/structured data is missing/, "Google is missing the details it uses to show your business with hours, directions and extras instead of a plain link."],
  [/buried more than 3 clicks/, "Pages buried that deep get few visitors and little ranking weight — important services effectively hide."],
  [/No tap-to-call/, "A customer on their phone has to memorize your number or copy it by hand instead of tapping once to call — plenty will just tap the next business instead."],
  [/No contact form or phone link/, "A visitor who is ready to hire you has no obvious way to reach you from the site."],
  [/No Product structured data/, "Search engines and AI can't read your products and prices as data — the page can be read, but nothing on it can be quoted as a product with a price."],
  [/no Offer \(price\)/, "Your products are declared but their prices aren't, so search results and AI answers can't quote what anything costs — and the price is usually the first thing a buyer wants to know."],
  [/No Article structured data/, "Search engines and AI tools can't reliably tell this post is an article or who wrote it, so it gets credited — and quoted — less than the same post properly marked up."],
  [/No FAQPage structured data/, "Your questions and answers are exactly the shape AI answers quote — without the markup, the page can be read, but its answers can't be lifted out and credited to you."],
  [/No LocalBusiness \/ Organization structured data on this location page/, "Google can't reliably tie this town's page to your business listing, so the page shows up weaker in maps and local results for people in that town."],
  [/No BreadcrumbList structured data/, "Search results show this page's bare address instead of where it sits on your site — less context for the searcher, and one less reason to tap your result over the next one."],
  [/No Service structured data/, "Search engines and AI tools have to guess what service this page offers and where, instead of being told outright — so it matches fewer of the searches that should find it."],
  [/No LocalBusiness \/ Organization structured data/, "Google can't reliably connect this site to your business listing, so you show up weaker in maps and local results."],
  [/invalid JSON/, "Google ignores structured data it can't read, so the business details written in it do nothing for you."],
  [/No machine-readable name, address or phone/, "Neither Google nor the directories can verify your business from your own website — and customers checking you out can't either."],
  [/Phone numbers disagree/, "Callers dial whichever number they see first; if it's the wrong one, they reach the wrong place — and you never know they tried."],
  [/Another phone number appears/, "A second number in the text can send callers to the wrong place if it isn't really yours."],
  [/Street addresses disagree/, "Customers and Google see two different locations for one business — that splits your local ranking and can send people to the wrong address."],
  [/business name is written .* different ways/, "Different versions of your name make Google less sure all of this belongs to one business, which weakens your local presence."],
  [/missing recommended details/, "Your business shows up with less than it could — no hours, no photo, fewer extras — next to competitors whose listings show more."],
  [/doesn't link to your Google Maps listing/, "Customers land on your site with no quick way to get directions, and Google gets one less signal that the site and the listing are the same business."],
  [/no Google review link/, "Happy customers have no easy path to leave the reviews that convince the next customer to call you."],
  [/doesn't link your .* profiles/, "Unlinked profiles fragment your presence — each one on its own convinces Google less than all of them tied together."],
  [/Google listing shows the phone number/, "People who find you on Google call a different number than people who find your site — one of those numbers may not reach you."],
  [/Google listing shows the address/, "Customers may drive to the address Google shows while your site says another — somebody ends up at the wrong place."],
  [/Google listing is named/, "Two names for one business leaves customers — and Google — unsure it's the same company."],
  [/Near-duplicate/, "Pages that read almost the same compete with each other and both rank worse for it; pages that differ only by city name can also read as doorway spam to Google."],
  [/No analytics tag/, "You can't see how many people visit, what they look at, or which pages lead to calls — so every decision about the site is a guess."],
  [/No mobile viewport/, "On phones the page renders shrunk down to desktop size — visitors have to pinch and zoom just to read it, and most won't bother."],
];

/** The business consequence for one engine finding; falls back to a plain, honest generic line. */
export function consequenceFor(issueText: string): string {
  for (const [pattern, line] of CONSEQUENCE_RULES) {
    if (pattern.test(issueText)) return line;
  }
  return "It's one more piece of friction between a customer finding you and a customer calling you.";
}

export async function deepAuditUrl(rawUrl: string): Promise<DeepAuditResult> {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter your website address, like joesplumbing.com." };
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let crawl;
  try {
    crawl = await crawlSite(candidate, {
      maxPages: DEEP_AUDIT_MAX_PAGES,
      budgetMs: DEEP_AUDIT_BUDGET_MS,
      concurrency: DEEP_AUDIT_CONCURRENCY,
      fetchTimeoutMs: DEEP_AUDIT_FETCH_TIMEOUT_MS,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The deep audit could not run on that address." };
  }

  const issues = auditIssues(crawl);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) counts[issue.severity] += 1;

  // Group by check type: the same check firing on many pages reads once. Issue texts embed
  // per-page numbers (a title's length, a page's word count), so the grouping key normalizes
  // digits — the displayed text keeps the first occurrence's wording, and the group carries
  // the affected-page count plus up to 3 example pages. Broken links are the exception: each
  // target is a distinct finding (the engine already aggregates its linking pages into the
  // text), so the target stays in the key.
  const grouped = new Map<string, DeepFinding>();
  for (const issue of issues) {
    const key =
      `${issue.severity}|${issue.issue.replace(/\d+/g, "#")}` +
      (issue.issue.startsWith("Broken link") ? `|${issue.page}` : "");
    const paths =
      issue.page === "site" ? [] : issue.page.split(", ").map((s) => s.trim()).filter(Boolean);
    const existing = grouped.get(key);
    if (existing) {
      existing.pages += 1;
      for (const p of paths) {
        if (existing.examples.length < 3 && !existing.examples.includes(p)) existing.examples.push(p);
      }
    } else {
      grouped.set(key, {
        severity: issue.severity,
        issue: issue.issue,
        fix: issue.fix,
        consequence: consequenceFor(issue.issue),
        pages: 1,
        firstPage: issue.page,
        examples: paths.slice(0, 3),
      });
    }
  }
  const findings = [...grouped.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.pages - a.pages
  );

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
