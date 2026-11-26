// Schema-expectation checks (2026-11-25): fixture proof against LIVE raw HTML.
// NOT part of `npm test` — run directly:  node scripts/schema-expectations-fixture.mjs
// Builds AuditedPages from live pages exactly the way crawlSite does (parsePage + the
// generator-side extras), runs auditIssues, and asserts:
//   1. sitesinc.co/store            -> the Product finding FIRES (the page has zero JSON-LD).
//   2. sitesinc.co/free-website-audit -> NO schema-expectation finding fires (FAQPage present).
//   3. a sitesinc.co blog article   -> the Article finding does NOT fire (BlogPosting present).
// Plus: nested-@type collection (Offer inside Product, @graph), per-page dedupe readiness,
// and a specific (non-fallback) consequence line for every new issue text.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { parsePage } = await import("../lib/factory/crawl.ts");
const {
  auditIssues,
  parseJsonLd,
  visibleText,
  detectMapEmbed,
  detectAnalytics,
  detectViewport,
  detectSchemaTypes,
} = await import("../lib/siteflow/generators/seo-audit.ts");
const { consequenceFor } = await import("../lib/deep-audit.ts");

const NEW_PATTERNS = [
  /No Article structured data/,
  /No FAQPage structured data/,
  /No Product structured data/,
  /no Offer \(price\)/,
  /on this location page/,
  /No Service structured data/,
];
const isNewFinding = (issue) => NEW_PATTERNS.some((re) => re.test(issue.issue));

async function auditedPage(url, path) {
  const res = await fetch(url, { headers: { "user-agent": "SitesInc schema fixture check" } });
  const html = await res.text();
  const origin = new URL(res.url).origin;
  const fetched = {
    ok: res.ok,
    status: res.status,
    body: html,
    finalUrl: res.url,
    contentType: res.headers.get("content-type") ?? "text/html",
    error: "",
    ttfbMs: null,
    bytes: html.length,
  };
  const page = {
    ...parsePage(origin, path, fetched),
    jsonLd: parseJsonLd(html),
    text: visibleText(html),
    embedsMap: detectMapEmbed(html),
    hasAnalytics: detectAnalytics(html),
    hasViewport: detectViewport(html),
    schemaTypesFound: detectSchemaTypes(html),
  };
  page.discoveredVia = "seed";
  return { origin, page };
}

function crawlOf(origin, pages) {
  return {
    origin,
    pages,
    robotsOk: true,
    sitemapOk: true,
    https: true,
    sitemapPaths: pages.map((p) => p.path),
    blockedPaths: [],
    brokenLinks: [],
  };
}

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
};

// --- Unit: nested @type collection (@graph + Offer nested inside Product) ---
const nestedHtml = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Guide","offers":{"@type":"Offer","price":"19"}}]}</script>`;
const nestedTypes = detectSchemaTypes(nestedHtml);
check("detectSchemaTypes collects nested types (@graph + Offer inside Product)", () => {
  assert.ok(nestedTypes.includes("Product"), `Product missing from ${nestedTypes}`);
  assert.ok(nestedTypes.includes("Offer"), `Offer missing from ${nestedTypes}`);
  assert.ok(nestedTypes.includes("WebPage"), `WebPage missing from ${nestedTypes}`);
});

// --- Live case 1: /store must fire the Product finding ---
const store = await auditedPage("https://sitesinc.co/store", "/store");
console.log(`\n/store: HTTP ${store.page.statusCode}, schemaTypesFound = [${store.page.schemaTypesFound.join(", ")}]`);
const storeIssues = auditIssues(crawlOf(store.origin, [store.page]));
check("/store -> Product finding FIRES", () => {
  const hit = storeIssues.find((i) => i.page === "/store" && /No Product structured data/.test(i.issue));
  assert.ok(hit, `no Product finding among: ${storeIssues.map((i) => i.issue).join(" | ")}`);
});

// Dedupe readiness: the same store page under a second store path must produce the identical
// (severity, issue) pair, which is what deep-audit's grouping collapses into one finding
// with an affected-page count.
const shopPage = { ...store.page, path: "/shop", url: `${store.origin}/shop` };
const twoStoreIssues = auditIssues(crawlOf(store.origin, [store.page, shopPage])).filter(
  (i) => /No Product structured data/.test(i.issue)
);
check("two store pages -> identical per-page Product issues (deep-audit dedupe input)", () => {
  assert.equal(twoStoreIssues.length, 2, `expected 2, got ${twoStoreIssues.length}`);
  assert.equal(twoStoreIssues[0].issue, twoStoreIssues[1].issue);
  assert.equal(twoStoreIssues[0].severity, twoStoreIssues[1].severity);
});

// --- Live case 2: /free-website-audit must stay silent (FAQPage present) ---
const audit = await auditedPage("https://sitesinc.co/free-website-audit", "/free-website-audit");
console.log(`\n/free-website-audit: HTTP ${audit.page.statusCode}, schemaTypesFound = [${audit.page.schemaTypesFound.join(", ")}]`);
const auditIssuesResult = auditIssues(crawlOf(audit.origin, [audit.page]));
check("/free-website-audit -> FAQPage detected in the page's types", () => {
  assert.ok(audit.page.schemaTypesFound.includes("FAQPage"), `FAQPage missing from ${audit.page.schemaTypesFound}`);
});
check("/free-website-audit -> NO schema-expectation finding fires (no false flags)", () => {
  const bad = auditIssuesResult.filter((i) => i.page === "/free-website-audit" && isNewFinding(i));
  assert.equal(bad.length, 0, `unexpected findings: ${bad.map((i) => i.issue).join(" | ")}`);
});

// --- Live case 3: a blog article must not fire the Article finding ---
const blog = await auditedPage(
  "https://sitesinc.co/blog/diy-vs-done-for-you-websites",
  "/blog/diy-vs-done-for-you-websites"
);
console.log(`\n/blog/diy-vs-done-for-you-websites: HTTP ${blog.page.statusCode}, schemaTypesFound = [${blog.page.schemaTypesFound.join(", ")}]`);
const blogIssues = auditIssues(crawlOf(blog.origin, [blog.page]));
check("blog article -> BlogPosting detected in the page's types", () => {
  assert.ok(blog.page.schemaTypesFound.includes("BlogPosting"), `BlogPosting missing from ${blog.page.schemaTypesFound}`);
});
check("blog article -> Article finding does NOT fire", () => {
  const bad = blogIssues.filter(
    (i) => i.page === "/blog/diy-vs-done-for-you-websites" && /No Article structured data/.test(i.issue)
  );
  assert.equal(bad.length, 0, `unexpected: ${bad.map((i) => i.issue).join(" | ")}`);
});

// --- Consequences: every new issue text maps to its own line, not the generic fallback ---
const FALLBACK = "It's one more piece of friction between a customer finding you and a customer calling you.";
const NEW_TEXTS = [
  "No Product structured data on this store page.",
  "Product structured data carries no Offer (price) on this store page.",
  "No Article structured data on this article page.",
  "No FAQPage structured data, though the page carries a questions-and-answers section.",
  "No LocalBusiness / Organization structured data on this location page.",
  "No BreadcrumbList structured data on this location page.",
  "No Service structured data on this service page.",
];
check("every new issue text has a specific consequence line", () => {
  for (const text of NEW_TEXTS) {
    assert.notEqual(consequenceFor(text), FALLBACK, `fallback used for: ${text}`);
  }
});

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll fixture checks passed.");
process.exit(failures ? 1 : 0);
