// Local SEO audit (Tier 2): Core Web Vitals (stubbed PageSpeed), structured-data property
// validation, internal-link depth, prioritized fix plan, and the before/after audit delta.
// Fixtures are hand-built CrawlResults in the Tier 1 test's shape; network and the document
// store are stubbed. No live calls.
//   node --test scripts/seo-audit-tier2.test.mjs   (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");

const {
  auditIssues,
  renderSeoAuditReport,
  parseJsonLd,
  schemaPropertyGaps,
  linkDepths,
  averageLinkDepth,
  fetchCoreWebVitals,
  cwvIssues,
  fixPlan,
  summarizeAudit,
  auditDelta,
  readAuditHistory,
  recordAuditSummary,
} = await import("../lib/siteflow/generators/seo-audit.ts");

const ORIGIN = "https://example.com";

/** A clean, healthy PageAudit; override any field per test. Tier 2 fixtures add `jsonLd`. */
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

/* --------------------------------- JSON-LD parsing ---------------------------------- */

test("parseJsonLd extracts nodes and flattens @graph; invalid blocks are skipped", () => {
  const html = `<script type="application/ld+json">{"@type":"Plumber","name":"Example"}</script>
<script type="application/ld+json">{"@graph":[{"@type":"WebSite","name":"Example","url":"https://example.com"}]}</script>
<script type="application/ld+json">{not json</script>`;
  const nodes = parseJsonLd(html);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0]["@type"], "Plumber");
  assert.equal(nodes[1]["@type"], "WebSite");
});

/* --------------------------------- Core Web Vitals ---------------------------------- */

function psiResponse(audits, score = 0.55) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      lighthouseResult: {
        categories: { performance: { score } },
        audits: Object.fromEntries(Object.entries(audits).map(([k, v]) => [k, { numericValue: v }])),
      },
    }),
  };
}

test("fetchCoreWebVitals parses the PageSpeed payload (score, LCP, CLS, TBT proxy)", async () => {
  let seenUrl = "";
  const cwv = await fetchCoreWebVitals(ORIGIN, {
    apiKey: "TESTKEY",
    fetchImpl: async (url) => {
      seenUrl = String(url);
      return psiResponse({ "largest-contentful-paint": 4600, "cumulative-layout-shift": 0.3, "total-blocking-time": 300 });
    },
  });
  assert.ok(cwv);
  assert.equal(cwv.performanceScore, 55);
  assert.equal(cwv.lcpMs, 4600);
  assert.equal(cwv.cls, 0.3);
  assert.equal(cwv.inpMs, null);
  assert.equal(cwv.tbtMs, 300);
  assert.match(seenUrl, /strategy=mobile/);
  assert.match(seenUrl, /key=TESTKEY/);
});

test("cwvIssues thresholds: LCP >4s high, >2.5s medium; CLS >0.25 high; INP >500 high, >200 medium", () => {
  const base = { strategy: "mobile", fetchedAt: new Date().toISOString(), performanceScore: 40, lcpMs: null, cls: null, inpMs: null, tbtMs: null };
  const bad = cwvIssues({ ...base, lcpMs: 4600, cls: 0.3, inpMs: 640 });
  assert.ok(has(bad, /Largest Contentful Paint/, "high"));
  assert.ok(has(bad, /layout shift score 0\.30/, "high"));
  assert.ok(has(bad, /Interaction to Next Paint/, "high"));

  const mid = cwvIssues({ ...base, lcpMs: 3000, cls: 0.18, inpMs: 250 });
  assert.ok(has(mid, /Largest Contentful Paint/, "medium"));
  assert.ok(has(mid, /layout shift/, "medium"));
  assert.ok(has(mid, /Interaction to Next Paint/, "medium"));

  const good = cwvIssues({ ...base, lcpMs: 1800, cls: 0.05, inpMs: 120 });
  assert.equal(good.length, 0);
  assert.equal(cwvIssues(null).length, 0);
});

test("PageSpeed failure degrades: null CWV, report says unavailable, rest of the audit intact", async () => {
  const quota = await fetchCoreWebVitals(ORIGIN, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
  assert.equal(quota, null);
  const boom = await fetchCoreWebVitals(ORIGIN, {
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(boom, null);

  const html = renderSeoAuditReport(result([page("/")]), { cwv: null });
  assert.match(html, /Performance data unavailable this run/);
  assert.match(html, /Health score: 100 \/ 100/);
});

/* ---------------------------- structured-data validation ----------------------------- */

const PLUMBER_NO_PHONE = [{ "@type": "Plumber", name: "Example Plumbing", address: { "@type": "PostalAddress", streetAddress: "1 Main St" } }];

test("schema validation: LocalBusiness subtype missing telephone is one aggregated low finding", () => {
  const pages = [page("/", { jsonLd: PLUMBER_NO_PHONE }), page("/services", { jsonLd: PLUMBER_NO_PHONE })];
  const gaps = schemaPropertyGaps(result(pages));
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].type, "Plumber");
  assert.equal(gaps[0].prop, "telephone");
  assert.equal(gaps[0].severity, "low");
  assert.deepEqual(gaps[0].pages, ["/", "/services"]);

  const issues = auditIssues(result(pages));
  const schemaIssues = issues.filter((i) => /structured data is missing "telephone"/.test(i.issue));
  assert.equal(schemaIssues.length, 1, "aggregated to a single site finding");
  assert.equal(schemaIssues[0].severity, "low");
  assert.equal(schemaIssues[0].page, "site");
  assert.match(schemaIssues[0].issue, /on 2 pages/);
});

test("schema validation: missing required address is medium; complete JSON-LD has no gaps", () => {
  const noAddress = [{ "@type": "LocalBusiness", name: "Example", telephone: "+1-909-555-0100" }];
  const gaps = schemaPropertyGaps(result([page("/", { jsonLd: noAddress })]));
  assert.deepEqual(gaps.map((g) => [g.prop, g.severity]), [["address", "medium"]]);

  const complete = [
    {
      "@type": "Plumber",
      name: "Example Plumbing",
      address: { "@type": "PostalAddress", streetAddress: "1 Main St" },
      telephone: "+1-909-555-0100",
    },
  ];
  assert.equal(schemaPropertyGaps(result([page("/", { jsonLd: complete })])).length, 0);
  // Pages without parsed JSON-LD (Tier 1 fixtures) are skipped, not flagged.
  assert.equal(schemaPropertyGaps(result([page("/")])).length, 0);
});

/* --------------------------------- link depth ---------------------------------------- */

test("link depth: BFS depths, a 4-click page is flagged as buried, average depth reported", () => {
  const pages = [
    page("/", { discoveredVia: "seed", internalLinks: [`${ORIGIN}/a`] }),
    page("/a", { internalLinks: [`${ORIGIN}/b`] }),
    page("/b", { internalLinks: [`${ORIGIN}/c`] }),
    page("/c", { internalLinks: [`${ORIGIN}/deep`] }),
    page("/deep"),
  ];
  const res = result(pages);
  const depths = linkDepths(res);
  assert.equal(depths.get("/"), 0);
  assert.equal(depths.get("/deep"), 4);
  assert.equal(averageLinkDepth(res), 2.5);

  const issues = auditIssues(res);
  const buried = issues.filter((i) => /buried more than 3 clicks/.test(i.issue));
  assert.equal(buried.length, 1);
  assert.equal(buried[0].severity, "low");
  assert.match(buried[0].issue, /\/deep/);

  const html = renderSeoAuditReport(res);
  assert.match(html, /average of 2\.5 clicks from the homepage/);
});

/* ----------------------------------- fix plan ---------------------------------------- */

test("fix plan ranks severity x reach, tags effort, and caps at 5", () => {
  const issues = [
    { severity: "low", page: "/a", issue: "No canonical link.", fix: "x" },
    { severity: "high", page: "site", issue: "The site is served over plain HTTP.", fix: "x" },
    { severity: "high", page: "/gone", issue: "Broken link: / links to this page, which returns HTTP 404.", fix: "x" },
    { severity: "high", page: "/a", issue: "Missing <title>.", fix: "x" },
    { severity: "medium", page: "/x, /y", issue: "Duplicate title \"Same\".", fix: "x" },
    { severity: "low", page: "/b", issue: "Thin content (90 words).", fix: "x" },
    { severity: "low", page: "/c", issue: "Missing Open Graph title/image.", fix: "x" },
  ];
  const plan = fixPlan(issues, 10);
  assert.equal(plan.length, 5);
  assert.equal(plan[0].issue.issue, "The site is served over plain HTTP.", "high x whole site ranks first");
  assert.equal(plan[0].pagesAffected, 10);
  assert.equal(plan[0].effort, "Involved");
  const broken = plan.find((p) => /Broken link/.test(p.issue.issue));
  assert.equal(broken.effort, "Moderate");
  const title = plan.find((p) => /Missing <title>/.test(p.issue.issue));
  assert.equal(title.effort, "Quick");
  // Deterministic: same input, same order.
  assert.deepEqual(fixPlan(issues, 10).map((p) => p.issue.issue), plan.map((p) => p.issue.issue));

  const html = renderSeoAuditReport(result([page("/", { title: "" }), page("/b", { title: "" })]));
  assert.match(html, /Fix these first/);
});

/* ------------------------------- history and delta ----------------------------------- */

function memoryStore() {
  const data = new Map();
  return {
    async read(origin) {
      return data.get(origin) ?? [];
    },
    async write(origin, history) {
      data.set(origin, history);
    },
  };
}

test("audit history: summaries accumulate per origin and cap at 5", async () => {
  const store = memoryStore();
  for (let n = 0; n < 7; n++) {
    await recordAuditSummary(summarizeAudit(ORIGIN, [], new Date(2026, 0, n + 1)), store);
  }
  const history = await readAuditHistory(ORIGIN, store);
  assert.equal(history.length, 5);
  assert.equal(history[history.length - 1].at, new Date(2026, 0, 7).toISOString());
  assert.deepEqual(await readAuditHistory("https://other.example", store), []);
});

test("delta: resolved, new and still-open findings plus the score change", () => {
  const stillOpen = { severity: "medium", page: "/", issue: "Missing meta description.", fix: "x" };
  const fixed = { severity: "high", page: "/gone", issue: "Broken link: / links to this page, which returns HTTP 404.", fix: "x" };
  const prior = summarizeAudit(ORIGIN, [stillOpen, fixed], new Date(2026, 9, 1));
  const fresh = { severity: "low", page: "/new", issue: "No canonical link.", fix: "x" };
  const current = summarizeAudit(ORIGIN, [stillOpen, fresh], new Date(2026, 10, 1));

  const delta = auditDelta(prior, current);
  assert.equal(delta.resolved.length, 1);
  assert.match(delta.resolved[0], /Broken link/);
  assert.equal(delta.added.length, 1);
  assert.match(delta.added[0], /No canonical link/);
  assert.equal(delta.stillOpen, 1);
  assert.equal(delta.scoreBefore, 93);
  assert.equal(delta.scoreAfter, 97);
});

test("render: second audit shows the delta section; first audit shows the first-audit line", () => {
  const res = result([page("/", { metaDescription: "" })]);
  const prior = summarizeAudit(
    ORIGIN,
    [
      { severity: "medium", page: "/", issue: "Missing meta description.", fix: "x" },
      { severity: "high", page: "/gone", issue: "Broken link: / links to this page, which returns HTTP 404.", fix: "x" },
    ],
    new Date(2026, 9, 1)
  );
  const second = renderSeoAuditReport(res, { prior });
  assert.match(second, /Since your last audit/);
  assert.match(second, /Fixed since then \(1\)/);
  assert.match(second, /Broken link/);

  const first = renderSeoAuditReport(res, { prior: null });
  assert.match(first, /First audit for this site — future audits will show what changed\./);

  const noContext = renderSeoAuditReport(res);
  assert.doesNotMatch(noContext, /Since your last audit/);
});

test("render: CWV section shows measured values and findings feed the score", () => {
  const cwv = {
    strategy: "mobile",
    fetchedAt: new Date().toISOString(),
    performanceScore: 41,
    lcpMs: 4600,
    cls: 0.3,
    inpMs: null,
    tbtMs: 300,
  };
  const html = renderSeoAuditReport(result([page("/")]), { cwv });
  assert.match(html, /Core Web Vitals/);
  assert.match(html, /41 \/ 100/);
  assert.match(html, /4\.6s/);
  assert.match(html, /Total Blocking Time/);
  // Two high CWV findings (LCP, CLS) at the homepage deduct 10 from a clean site's 100.
  assert.match(html, /Health score: 90 \/ 100/);
});
