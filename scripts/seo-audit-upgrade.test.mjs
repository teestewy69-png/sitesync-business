// Local SEO audit (Tier 1 upgrade): new check families, health-score math, existing checks intact.
// Pure fixture tests — auditIssues/healthScore/renderSeoAuditReport run on hand-built CrawlResults
// shaped exactly like lib/factory/types.ts PageAudit. No network.
//   node --test scripts/seo-audit-upgrade.test.mjs   (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");

const { auditIssues, healthScore, renderSeoAuditReport, SEO_AUDIT_PAGE_LIMIT } = await import(
  "../lib/siteflow/generators/seo-audit.ts"
);

const ORIGIN = "https://example.com";

/** A clean, healthy PageAudit; override any field per test. */
function page(path, over = {}) {
  return {
    url: `${ORIGIN}${path}`,
    path,
    statusCode: 200,
    title: `Title for ${path} from Example Plumbing`,
    metaDescription: `Unique description for ${path}: Example Plumbing serves Walnut homes and businesses.`,
    canonical: `${ORIGIN}${path}`,
    robots: "",
    wordCount: 520,
    headings: { h1: ["Example Plumbing"], h2: [], h3: [] },
    schemaTypes: ["Plumber"],
    ogTitle: "Example Plumbing",
    ogDescription: "Plumber in Walnut",
    ogImage: `${ORIGIN}/og.jpg`,
    images: [],
    missingAlt: 0,
    internalLinks: [],
    externalLinks: ["tel:+19095550100"],
    forms: [{ action: "/contact", method: "post", fields: ["email"] }],
    ttfbMs: 300,
    bytes: 48_000,
    error: "",
    ...over,
  };
}

function result(pages, over = {}) {
  return {
    origin: ORIGIN,
    pages,
    robotsOk: true,
    sitemapOk: true,
    https: true,
    sitemapPaths: pages.map((p) => p.path),
    blockedPaths: [],
    brokenLinks: [],
    ...over,
  };
}

const has = (issues, re, severity) =>
  issues.some((i) => re.test(i.issue) && (severity === undefined || i.severity === severity));

test("page budget raised to 100", () => {
  assert.equal(SEO_AUDIT_PAGE_LIMIT, 100);
});

test("existing checks still fire: missing title, missing description, noindex", () => {
  const issues = auditIssues(
    result([
      page("/", { title: "", metaDescription: "" }),
      page("/hidden", { robots: "noindex, follow" }),
    ])
  );
  assert.ok(has(issues, /Missing <title>/, "high"));
  assert.ok(has(issues, /Missing meta description/, "medium"));
  assert.ok(has(issues, /marked noindex/, "high"));
});

test("broken internal link is named with the page that links to it", () => {
  const home = page("/", { internalLinks: [`${ORIGIN}/gone`, `${ORIGIN}/ok`] });
  const ok = page("/ok", { internalLinks: [`${ORIGIN}/`] });
  const issues = auditIssues(
    result([home, ok], { brokenLinks: [{ from: "/", path: "/gone", status: 404, error: "HTTP 404" }] })
  );
  const broken = issues.find((i) => /Broken link/.test(i.issue));
  assert.ok(broken, "expected a broken-link finding");
  assert.equal(broken.severity, "high");
  assert.equal(broken.page, "/gone");
  assert.match(broken.issue, /HTTP 404/);
  assert.match(broken.issue, /\//);
});

test("unreachable probed link target is flagged as broken", () => {
  const home = page("/", { internalLinks: [`${ORIGIN}/dead`] });
  const issues = auditIssues(
    result([home], { brokenLinks: [{ from: "/", path: "/dead", status: null, error: "Connection refused" }] })
  );
  assert.ok(has(issues, /Broken link: .*could not be reached/, "high"));
});

test("orphan: sitemap-only page with no inbound links flagged; linked sitemap page is not", () => {
  const home = page("/", { discoveredVia: "seed", internalLinks: [`${ORIGIN}/services`] });
  const services = page("/services", { discoveredVia: "sitemap", internalLinks: [`${ORIGIN}/`] });
  const orphan = page("/special-offer", { discoveredVia: "sitemap" });
  const issues = auditIssues(result([home, services, orphan]));
  const orphanIssues = issues.filter((i) => /Orphan page/.test(i.issue));
  assert.equal(orphanIssues.length, 1);
  assert.equal(orphanIssues[0].page, "/special-offer");
  assert.equal(orphanIssues[0].severity, "medium");
});

test("duplicate meta descriptions flagged once, naming both pages", () => {
  const desc = "Same description on two different pages of the site.";
  const issues = auditIssues(result([page("/a", { metaDescription: desc }), page("/b", { metaDescription: desc })]));
  const dup = issues.filter((i) => /Duplicate meta description/.test(i.issue));
  assert.equal(dup.length, 1);
  assert.equal(dup[0].severity, "medium");
  assert.match(dup[0].page, /\/a/);
  assert.match(dup[0].page, /\/b/);
});

test("thin content check retained", () => {
  const issues = auditIssues(result([page("/", { wordCount: 80 })]));
  assert.ok(has(issues, /Thin content \(80 words\)/, "low"));
});

test("robots-blocked sitemap page flagged; whole-sitemap block is high", () => {
  const one = auditIssues(
    result([page("/")], { sitemapPaths: ["/", "/members"], blockedPaths: ["/members"] })
  );
  const blockedIssue = one.find((i) => i.page === "/members" && /robots\.txt blocks/.test(i.issue));
  assert.ok(blockedIssue, "expected a blocked-page finding");
  assert.equal(blockedIssue.severity, "medium");

  const all = auditIssues(
    result([page("/")], { sitemapPaths: ["/", "/members"], blockedPaths: ["/", "/members"] })
  );
  assert.ok(has(all, /blocks every page listed in your sitemap/, "high"));
});

test("crawled pages missing from the sitemap are reported once, site-level", () => {
  const home = page("/", { internalLinks: [`${ORIGIN}/extra`] });
  const extra = page("/extra", { discoveredVia: "link" });
  const issues = auditIssues(result([home, extra], { sitemapPaths: ["/"] }));
  const miss = issues.filter((i) => /not listed in the sitemap/.test(i.issue));
  assert.equal(miss.length, 1);
  assert.equal(miss[0].severity, "low");
  assert.match(miss[0].issue, /\/extra/);
});

test("performance and mixed-content signals: slow TTFB, heavy page, http images on https", () => {
  const heavy = page("/", {
    ttfbMs: 3_400,
    bytes: 1_850_000,
    images: [{ src: "http://example.com/banner.jpg", alt: "Banner" }],
  });
  const issues = auditIssues(result([heavy]));
  assert.ok(has(issues, /Slow first response \(3400 ms/, "low"));
  assert.ok(has(issues, /Very heavy page/, "low"));
  assert.ok(has(issues, /mixed content/, "low"));
});

test("health score: clean site scores 100 with zero findings", () => {
  const issues = auditIssues(result([page("/")]));
  assert.equal(issues.length, 0);
  assert.equal(healthScore(issues), 100);
});

test("health score: exact math, determinism, per-page cap, floor at 0", () => {
  const mixed = [
    { severity: "high", page: "site", issue: "a", fix: "b" },
    { severity: "medium", page: "/a", issue: "a", fix: "b" },
    { severity: "low", page: "/a", issue: "a", fix: "b" },
  ];
  assert.equal(healthScore(mixed), 100 - 5 - 2 - 1);
  assert.equal(healthScore(mixed), healthScore(mixed), "deterministic");

  const oneBadPage = Array.from({ length: 10 }, () => ({ severity: "high", page: "/bad", issue: "x", fix: "y" }));
  assert.equal(healthScore(oneBadPage), 100 - 20, "per-page deduction capped at 20");

  const disaster = Array.from({ length: 40 }, (_, n) => ({ severity: "high", page: `/p${n}`, issue: "x", fix: "y" }));
  assert.equal(healthScore(disaster), 0, "never below 0");
});

test("report renders the score with its calculation explanation", () => {
  const html = renderSeoAuditReport(result([page("/")]));
  assert.match(html, /Health score: 100 \/ 100/);
  assert.match(html, /How the score is calculated/);
  assert.match(html, /not a ranking prediction/);
});
