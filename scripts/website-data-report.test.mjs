// Website Data Rec #4: the client monthly report renderer + download route.
// Renderer is pure (fixture in, HTML out). Route follows the established
// route-test pattern (scripts/client-content.test.mjs): import the handler,
// call it directly — no network (no GA/GSC env in this env => not_connected).
//   node --test scripts/website-data-report.test.mjs
import { register } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
register("./fixtures/ts-resolver.mjs", import.meta.url);

for (const k of ["NETLIFY", "CONTEXT", "SITE_ID", "NETLIFY_BLOBS_CONTEXT", "DEPLOY_PRIME_URL", "URL", "NEXT_PUBLIC_SITE_URL"]) delete process.env[k];
for (const k of ["GA4_PROPERTY_ID", "GOOGLE_SEARCH_CONSOLE_SITE_URL", "GOOGLE_SERVICE_ACCOUNT_KEY_FILE", "FACTORY_ACCESS_TOKEN"]) delete process.env[k];
process.env.FACTORY_ACCESS_TOKEN = "report-test-token";
process.env.SITESINC_STORE = "local";
process.chdir(mkdtempSync(path.join(tmpdir(), "website-data-report-"))); // isolated ./data store

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { renderClientReport } = await import("../lib/factory/website-data-report.ts");
const reportRoute = await import("../app/api/factory/website-data/report/route.ts");
const { FACTORY_COOKIE, sessionValue } = await import("../lib/factory/auth.ts");
const { NextRequest } = await import("next/server");

function metric(value, changePct, source, extra = {}) {
  return { value, changePct, available: value != null, source, ...extra };
}

function baseReport(overrides = {}) {
  return {
    site: { id: "sitesinc", name: "sitesinc.co", kind: "sitesinc", ga4PropertyId: "123456", gscSiteUrl: "https://sitesinc.co/" },
    period: {
      preset: "30d",
      start: "2026-10-03",
      end: "2026-11-01",
      priorStart: "2026-09-03",
      priorEnd: "2026-10-02",
      label: "Last 30 days",
      days: 30,
    },
    sources: { ga4: "ok", gsc: "ok", missing: [] },
    metrics: {
      conversions: metric(42, 20, "ga4", { tracked: true }),
      visitors: metric(1234, 12.5, "ga4"),
      pageViews: metric(3456, -5, "ga4"),
      impressions: metric(9876, 3, "gsc"),
      clicks: metric(321, 8, "gsc"),
      ctr: metric(0.0443, 2.1, "gsc"),
      position: metric(5.14, -37.8, "gsc", { lowerIsBetter: true }),
      revenue: metric(1234.5, 10, "ga4", { tracked: true }),
    },
    dailyVisitors: [{ date: "2026-11-01", users: 50 }],
    topPages: [{ label: "/pricing", value: 500, share: 0.5 }],
    topQueries: [{ label: "web design walnut", value: 120, share: 0.37 }],
    queryRows: [{ label: "web design walnut", clicks: 120, impressions: 2400, ctr: 0.05, position: 4.26, share: 0.37 }],
    topEvents: [{ label: "click_to_call", value: 30, share: 0.71 }],
    topChannels: [{ label: "Organic Search", value: 800, share: 0.65 }],
    topCities: [{ label: "Walnut", value: 200, share: 0.16 }],
    collectedRevenue: { amount: 1995, priorAmount: 129, start: "2026-10-03", end: "2026-11-01" },
    // Carried by the model but an internal flip metric: must never render.
    estimatedValue: { status: "ok", amount: 987654, formula: "GA4 purchaseRevenue × 2, estimated value", note: "estimated value note" },
    fetchedAt: "2026-11-01T12:00:00.000Z",
    live: true,
    ...overrides,
  };
}

test("header carries site, domain, period and the SitesInc byline", () => {
  const html = renderClientReport(baseReport());
  assert.match(html, /sitesinc\.co/);
  assert.match(html, /2026-10-03 → 2026-11-01/);
  assert.match(html, /Prepared by SitesInc/);
  assert.match(html, /November 1, 2026/);
});

test("KPI rows format like the dashboard: CTR %, one-decimal position, money, counts", () => {
  const html = renderClientReport(baseReport());
  assert.match(html, /4\.4%/); // ctr 0.0443 via formatRatePct
  assert.match(html, />5\.1</); // position toFixed(1)
  assert.match(html, /lower is better/);
  assert.match(html, /\$1,234\.50/); // GA4 revenue
  assert.match(html, />1,234</); // visitors count
  assert.match(html, />42</); // key actions
  assert.match(html, /Calls, forms &amp; bookings marked as key events in GA4/);
});

test("position change uses lowerIsBetter tone: improvement is ok, worsening is bad", () => {
  const improved = renderClientReport(baseReport());
  const posRow = improved.slice(improved.indexOf("Avg. position"), improved.indexOf("Avg. position") + 700);
  assert.match(posRow, /-38% vs prior/);
  assert.match(posRow, /class="ok"/);

  const worse = baseReport();
  worse.metrics = { ...worse.metrics, position: metric(9.4, 25, "gsc", { lowerIsBetter: true }) };
  const worsened = renderClientReport(worse);
  const worseRow = worsened.slice(worsened.indexOf("Avg. position"), worsened.indexOf("Avg. position") + 700);
  assert.match(worseRow, /\+25% vs prior/);
  assert.match(worseRow, /class="bad"/);
});

test("untracked conversions: honest line in the KPI row, breakdown section omitted", () => {
  const report = baseReport();
  report.metrics = {
    ...report.metrics,
    conversions: { value: null, changePct: null, available: false, source: "ga4", tracked: false },
  };
  const html = renderClientReport(report);
  assert.ok(html.includes("Not tracked — key events aren't marked in GA4 yet"));
  assert.ok(!html.includes("Key actions breakdown"), "untracked => no breakdown section");
});

test("Stripe collected revenue: sitesinc row only, never on a client report", () => {
  const html = renderClientReport(baseReport());
  assert.match(html, /Collected via Stripe \(SiteFlow\)/);
  assert.match(html, /\$1,995\.00 \(prior period \$129\.00\)/);

  const client = baseReport({
    site: { id: "client_1", name: "Acme Plumbing", kind: "client", ga4PropertyId: "999", gscSiteUrl: "https://acme.example/" },
    collectedRevenue: null,
  });
  assert.ok(!renderClientReport(client).includes("Collected via Stripe"));

  // Even if a client report somehow carried a ledger figure, the kind gate holds.
  const clientWithFigure = baseReport({
    site: { id: "client_1", name: "Acme Plumbing", kind: "client", ga4PropertyId: "999", gscSiteUrl: "https://acme.example/" },
  });
  assert.ok(!renderClientReport(clientWithFigure).includes("Collected via Stripe"));
});

test("every interpolated string is escaped (query labels are attacker-controllable)", () => {
  const report = baseReport();
  report.queryRows = [{ label: "<script>alert(1)</script>", clicks: 1, impressions: 2, ctr: 0.5, position: 1.5, share: 1 }];
  report.topCities = [{ label: 'Walnut " onmouseover="alert(2)', value: 3, share: 1 }];
  const html = renderClientReport(report);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script"), "no script tag anywhere in the document");
  assert.ok(!html.includes('onmouseover="alert(2)'));
});

test("the internal valuation never appears in a client document", () => {
  const html = renderClientReport(baseReport());
  assert.ok(!/estimated value/i.test(html));
  assert.ok(!html.includes("× 2"));
  assert.ok(!html.includes("987,654"));
  assert.ok(!html.includes("Estimated value"));
});

test("empty sections say so instead of rendering blank", () => {
  const report = baseReport({ topPages: [], queryRows: [], topChannels: [], topCities: [], topEvents: [] });
  const html = renderClientReport(report);
  const occurrences = html.split("No data for this period.").length - 1;
  assert.ok(occurrences >= 5, `expected >=5 no-data lines, got ${occurrences}`);
});

test("not_connected report still renders, carrying the honest notices", () => {
  const unavailable = (source, extra = {}) => ({ value: null, changePct: null, available: false, source, ...extra });
  const report = baseReport({
    sources: {
      ga4: "not_connected",
      gsc: "not_connected",
      ga4Message: "Missing: GA4_PROPERTY_ID",
      gscMessage: "Missing: GOOGLE_SEARCH_CONSOLE_SITE_URL",
      missing: ["GA4_PROPERTY_ID", "GOOGLE_SEARCH_CONSOLE_SITE_URL"],
    },
    metrics: {
      conversions: unavailable("ga4", { tracked: false }),
      visitors: unavailable("ga4"),
      pageViews: unavailable("ga4"),
      impressions: unavailable("gsc"),
      clicks: unavailable("gsc"),
      ctr: unavailable("gsc"),
      position: unavailable("gsc", { lowerIsBetter: true }),
      revenue: unavailable("ga4", { tracked: false }),
    },
    dailyVisitors: [],
    topPages: [],
    topQueries: [],
    queryRows: [],
    topEvents: [],
    topChannels: [],
    topCities: [],
    collectedRevenue: null,
    live: false,
  });
  const html = renderClientReport(report);
  assert.match(html, /not connected yet/);
  assert.match(html, /Missing: GA4_PROPERTY_ID/);
  assert.match(html, /Prepared by SitesInc/);
  assert.match(html, /Google Analytics and Google Search Console/);
});

/* --------------------------------- route ---------------------------------- */

test("report route: 401 without a factory session", async () => {
  const res = await reportRoute.GET(new NextRequest("http://127.0.0.1/api/factory/website-data/report"));
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.match(data.error, /authentication/i);
});

test("report route: downloads the report document with a session", async () => {
  const cookie = await sessionValue("report-test-token");
  const req = new NextRequest("http://127.0.0.1/api/factory/website-data/report?preset=30d", {
    headers: { cookie: `${FACTORY_COOKIE}=${cookie}` },
  });
  const res = await reportRoute.GET(req);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  const disposition = res.headers.get("content-disposition") || "";
  assert.match(disposition, /attachment/);
  assert.match(disposition, /website-report-sitesinc-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.html/);
  const body = await res.text();
  assert.match(body, /Prepared by SitesInc/);
  // No GA/GSC env in this test env: the document carries the not-connected
  // notices instead of erroring — the chosen behavior, matching the page.
  assert.match(body, /not connected yet/);
});
