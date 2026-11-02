// Website data dashboard: period math, parsers, property isolation, graceful states (no network).
//   node --test scripts/website-data.test.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const {
  addUtcDays,
  buildWebsiteDataReport,
  daysInclusive,
  estimateSiteValue,
  inferPreset,
  listWebsiteDataSites,
  parseGaDaily,
  parseGaRangeTotals,
  parseGaTopPages,
  parseGscQueries,
  parseGscTotals,
  percentChange,
  rankedShares,
  resolvePeriod,
  resolveWebsiteDataSite,
  sparklinePath,
  ESTIMATED_VALUE_MULTIPLE,
  SITESINC_SITE_ID,
} = await import("../lib/factory/website-data.ts");
const { FACTORY_PROJECT_ID } = await import("../lib/factory/types.ts");
const { SCOPE_ANALYTICS } = await import("../lib/factory/google-auth.ts");

test("period presets and prior window are inclusive UTC dates", () => {
  const today = "2026-11-01";
  const d30 = resolvePeriod({ preset: "30d", today });
  assert.equal(d30.ok, true);
  assert.equal(d30.start, "2026-10-03");
  assert.equal(d30.end, today);
  assert.equal(d30.days, 30);
  assert.equal(d30.priorEnd, "2026-10-02");
  assert.equal(d30.priorStart, "2026-09-03");
  assert.equal(d30.preset, "30d");
  assert.equal(d30.label, "Last 30 days");

  const day = resolvePeriod({ preset: "today", today });
  assert.equal(day.start, today);
  assert.equal(day.end, today);
  assert.equal(day.priorStart, "2026-10-31");
  assert.equal(day.priorEnd, "2026-10-31");

  const week = resolvePeriod({ preset: "7d", today });
  assert.equal(week.start, "2026-10-26");
  assert.equal(week.days, 7);

  const custom = resolvePeriod({ from: "2026-10-01", to: "2026-10-10", today });
  assert.equal(custom.ok, true);
  assert.equal(custom.preset, "custom");
  assert.equal(custom.days, 10);
  assert.equal(custom.priorStart, "2026-09-21");
  assert.equal(custom.priorEnd, "2026-09-30");
  assert.equal(inferPreset("2026-10-03", today, today), "30d");
  assert.equal(daysInclusive("2026-10-03", today), 30);
  assert.equal(addUtcDays("2026-11-01", -1), "2026-10-31");
});

test("period validation rejects inverted and oversized ranges", () => {
  const bad = resolvePeriod({ from: "2026-11-02", to: "2026-11-01", today: "2026-11-01" });
  assert.equal(bad.ok, false);
  const huge = resolvePeriod({ from: "2025-01-01", to: "2026-11-01", today: "2026-11-01" });
  assert.equal(huge.ok, false);
});

test("percent change and ranked shares", () => {
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(80, 100), -20);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(10, 0), null);
  const ranks = rankedShares([
    { label: "/", value: 80 },
    { label: "/a", value: 20 },
  ]);
  assert.equal(ranks[0].share, 0.8);
  assert.equal(rankedShares([]).length, 0);
});

test("GA4 and GSC parsers, including empty reports", () => {
  const ranges = parseGaRangeTotals({
    rows: [
      { dimensionValues: [{ value: "current" }], metricValues: [{ value: "1280" }, { value: "3410" }, { value: "540" }] },
      { dimensionValues: [{ value: "prior" }], metricValues: [{ value: "1140" }, { value: "3120" }, { value: "510" }] },
    ],
  });
  assert.deepEqual(ranges.current, [1280, 3410, 540]);
  assert.deepEqual(ranges.prior, [1140, 3120, 510]);
  const alt = parseGaRangeTotals({
    rows: [{ dimensionValues: [{ value: "date_range_1" }], metricValues: [{ value: "5" }, { value: "6" }, { value: "7" }] }],
  });
  assert.deepEqual(alt.prior, [5, 6, 7]);
  assert.deepEqual(parseGaRangeTotals({}).current, [0, 0, 0]);
  assert.deepEqual(parseGaDaily({ rows: [{ dimensionValues: [{ value: "20261003" }], metricValues: [{ value: "12" }] }] }), [
    { date: "2026-10-03", users: 12 },
  ]);
  assert.deepEqual(parseGaTopPages({}), []);
  assert.deepEqual(parseGscTotals({}), { clicks: 0, impressions: 0 });
  assert.deepEqual(parseGscQueries({ rows: [{ keys: ["sitesinc"], clicks: 18, impressions: 90 }] }), [
    { label: "sitesinc", value: 18 },
  ]);
});

test("estimated value is a documented multiple or an honest placeholder", () => {
  const none = estimateSiteValue(null);
  assert.equal(none.status, "placeholder");
  assert.equal(none.amount, null);
  const zero = estimateSiteValue(0);
  assert.equal(zero.status, "placeholder");
  const ok = estimateSiteValue(750);
  assert.equal(ok.status, "ok");
  assert.equal(ok.amount, 750 * ESTIMATED_VALUE_MULTIPLE);
  assert.match(ok.formula, /purchaseRevenue/);
});

test("sparkline path is empty without points and draws with values", () => {
  assert.deepEqual(sparklinePath([]), { line: "", area: "" });
  const drawn = sparklinePath([1, 2, 3]);
  assert.match(drawn.line, /^M/);
  assert.match(drawn.area, /Z$/);
});

test("default site is sitesinc; a client never inherits env properties", async () => {
  const env = { GA4_PROPERTY_ID: "123456789", GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:sitesinc.co" };
  const def = await resolveWebsiteDataSite(undefined, { env });
  assert.equal(def.id, SITESINC_SITE_ID);
  assert.equal(def.ga4PropertyId, "123456789");
  assert.equal(def.gscSiteUrl, "sc-domain:sitesinc.co");
  const alias = await resolveWebsiteDataSite(FACTORY_PROJECT_ID, { env });
  assert.equal(alias.id, SITESINC_SITE_ID);

  const client = await resolveWebsiteDataSite("client-1", {
    env,
    findProject: async () => ({ id: "client-1", businessName: "Local Shop", ga4PropertyId: "999888777", gscSiteUrl: "sc-domain:local.shop" }),
  });
  assert.equal(client.kind, "client");
  assert.equal(client.ga4PropertyId, "999888777");
  assert.equal(client.gscSiteUrl, "sc-domain:local.shop");

  const bare = await resolveWebsiteDataSite("client-bare", {
    env,
    findProject: async () => ({ id: "client-bare", businessName: "Bare" }),
  });
  assert.equal(bare.ga4PropertyId, "");
  assert.equal(bare.gscSiteUrl, "");

  const unknown = await resolveWebsiteDataSite("nope", { env, findProject: async () => null });
  assert.equal(unknown.kind, "unknown");

  const listed = await listWebsiteDataSites({
    env,
    listProjects: async () => [
      { id: "wired", businessName: "Wired", ga4PropertyId: "111222333" },
      { id: "plain", businessName: "Plain" },
    ],
  });
  assert.equal(listed[0].id, SITESINC_SITE_ID);
  assert.equal(listed.length, 2);
  assert.equal(listed[1].id, "wired");
});

test("missing credentials return not_connected and never call Google", async () => {
  let called = false;
  const res = await buildWebsiteDataReport(
    { preset: "7d" },
    {
      env: {},
      keyFileOk: false,
      now: () => new Date("2026-11-01T12:00:00Z"),
      fetchImpl: async () => {
        called = true;
        return {};
      },
    }
  );
  assert.equal("error" in res, false);
  assert.equal(res.live, false);
  assert.equal(res.sources.ga4, "not_connected");
  assert.equal(res.sources.gsc, "not_connected");
  assert.ok(res.sources.missing.includes("GA4_PROPERTY_ID"));
  assert.ok(res.sources.missing.includes("GOOGLE_SEARCH_CONSOLE_SITE_URL"));
  assert.equal(res.metrics.visitors.available, false);
  assert.equal(res.metrics.visitors.value, null);
  assert.equal(res.estimatedValue.status, "placeholder");
  assert.equal(called, false);
});

test("a bare client does not fall back to the Sitesinc property", async () => {
  let called = false;
  const res = await buildWebsiteDataReport(
    { siteId: "client-bare", preset: "30d" },
    {
      env: { GA4_PROPERTY_ID: "123456789", GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:sitesinc.co" },
      keyFileOk: true,
      now: () => new Date("2026-11-01T12:00:00Z"),
      findProject: async () => ({ id: "client-bare", businessName: "Bare" }),
      fetchImpl: async () => {
        called = true;
        return {};
      },
    }
  );
  assert.equal(res.live, false);
  assert.deepEqual(res.sources.missing, ["ga4PropertyId", "gscSiteUrl"]);
  assert.match(res.sources.ga4Message, /not used/i);
  assert.equal(called, false);
});

function jsonOk(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
}

test("mocked GA4 + GSC populate live metrics, deltas, sparkline rows and top lists", async () => {
  const calls = [];
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    {
      env: { GA4_PROPERTY_ID: "123456789", GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:sitesinc.co" },
      keyFileOk: true,
      now: () => new Date("2026-11-01T12:00:00Z"),
      getGaToken: async (scope) => (assert.equal(scope, SCOPE_ANALYTICS), "ga-token"),
      getGscToken: async () => "gsc-token",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(init.body) });
        if (String(url).includes("analyticsdata")) {
          return jsonOk({
            reports: [
              {
                rows: [
                  { dimensionValues: [{ value: "current" }], metricValues: [{ value: "1280" }, { value: "3410" }, { value: "540" }] },
                  { dimensionValues: [{ value: "prior" }], metricValues: [{ value: "1143" }, { value: "3128" }, { value: "509" }] },
                ],
              },
              {
                rows: [
                  { dimensionValues: [{ value: "20261031" }], metricValues: [{ value: "40" }] },
                  { dimensionValues: [{ value: "20261101" }], metricValues: [{ value: "50" }] },
                ],
              },
              { rows: [{ dimensionValues: [{ value: "/" }], metricValues: [{ value: "200" }] }] },
              { rows: [{ metricValues: [{ value: "1620" }] }] },
            ],
          });
        }
        const body = JSON.parse(init.body);
        if ((body.dimensions || [])[0] === "query") {
          return jsonOk({ rows: [{ keys: ["website design"], clicks: 31, impressions: 400 }] });
        }
        if (body.startDate === "2026-10-03") {
          return jsonOk({ rows: [{ clicks: 902, impressions: 24800 }] });
        }
        return jsonOk({ rows: [{ clicks: 930, impressions: 21000 }] });
      },
    }
  );
  assert.equal(res.live, true);
  assert.equal(res.metrics.visitors.value, 1280);
  assert.ok(res.metrics.visitors.changePct > 0);
  assert.equal(res.metrics.pageViews.value, 3410);
  assert.equal(res.metrics.impressions.value, 24800);
  assert.equal(res.metrics.clicks.value, 902);
  assert.equal(res.metrics.revenue.tracked, true);
  assert.equal(res.metrics.revenue.value, 540);
  assert.equal(res.dailyVisitors.length, 2);
  assert.equal(res.topPages[0].label, "/");
  assert.equal(res.topQueries[0].label, "website design");
  assert.equal(res.estimatedValue.status, "ok");
  assert.equal(res.estimatedValue.amount, 3240);
  assert.ok(calls.some((c) => c.url.includes("properties/123456789:batchRunReports")));
  assert.ok(calls.some((c) => c.url.includes("sc-domain%3Asitesinc.co")));
});

test("GA4 403 and GSC 403 become error states without inventing numbers", async () => {
  const res = await buildWebsiteDataReport(
    { preset: "today" },
    {
      env: { GA4_PROPERTY_ID: "123456789", GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:sitesinc.co" },
      keyFileOk: true,
      now: () => new Date("2026-11-01T12:00:00Z"),
      getGaToken: async () => "t",
      getGscToken: async () => "t",
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => "PERMISSION_DENIED", json: async () => ({}) }),
    }
  );
  assert.equal(res.live, false);
  assert.equal(res.sources.ga4, "error");
  assert.equal(res.sources.gsc, "error");
  assert.match(res.sources.ga4Message, /403/);
  assert.equal(res.metrics.visitors.value, null);
  assert.equal(res.estimatedValue.status, "placeholder");
});
