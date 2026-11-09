// Website data search depth (Rec #2): GSC CTR + average position KPIs and per-query depth (no network).
//   node --test scripts/website-data-search.test.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const { buildWebsiteDataReport, formatRatePct, parseGscQueryRows, parseGscRates, percentChange } = await import(
  "../lib/factory/website-data.ts"
);

function jsonOk(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
}

function jsonErr(status, text) {
  return { ok: false, status, json: async () => ({}), text: async () => text };
}

/** GA reports aligned to whatever requests were actually sent (same fixture shape as Rec #1). */
function gaReportsFor(requests) {
  const totals = { totalUsers: ["1280", "1143"], screenPageViews: ["3410", "3128"], purchaseRevenue: ["540", "509"], keyEvents: ["46", "38"] };
  return requests.map((req) => {
    const dims = (req.dimensions || []).map((d) => d.name);
    const mets = (req.metrics || []).map((m) => m.name);
    if (dims.includes("date")) {
      return {
        rows: [
          { dimensionValues: [{ value: "20261031" }], metricValues: [{ value: "40" }] },
          { dimensionValues: [{ value: "20261101" }], metricValues: [{ value: "50" }] },
        ],
      };
    }
    if (dims.includes("pagePath")) {
      return { rows: [{ dimensionValues: [{ value: "/" }], metricValues: [{ value: "200" }] }] };
    }
    if (dims.includes("eventName")) {
      return { rows: [{ dimensionValues: [{ value: "generate_lead" }], metricValues: [{ value: "30" }] }] };
    }
    if ((req.dateRanges || []).length === 2) {
      const row = (name, i) => ({
        dimensionValues: [{ value: name }],
        metricValues: mets.map((m) => ({ value: totals[m][i] })),
      });
      return { rows: [row("current", 0), row("prior", 1)] };
    }
    return { rows: [{ metricValues: [{ value: "1620" }] }] };
  });
}

const GSC_QUERY_ROWS = {
  rows: [
    { keys: ["plumber near me"], clicks: 120, impressions: 2000, ctr: 0.06, position: 4.2 },
    { keys: ["website design"], clicks: 31, impressions: 400, ctr: 0.0775, position: 6.8 },
  ],
};

// Preset 30d with now = 2026-11-01: current 2026-10-03 → 2026-11-01, prior 2026-09-03 → 2026-10-02.
const IMPROVING = {
  current: { clicks: 930, impressions: 21000, ctr: 0.0443, position: 5.1 },
  prior: { clicks: 902, impressions: 24800, ctr: 0.0364, position: 8.2 },
};
const WORSENING_POSITION = {
  current: { clicks: 930, impressions: 21000, ctr: 0.0443, position: 9.4 },
  prior: { clicks: 902, impressions: 24800, ctr: 0.0364, position: 5.0 },
};

function makeFetch(totals, { gscFails = false } = {}) {
  return async (url, init) => {
    const u = String(url);
    if (u.includes("analyticsdata")) {
      const body = JSON.parse(init.body);
      return jsonOk({ reports: gaReportsFor(body.requests) });
    }
    if (gscFails) return jsonErr(403, "PERMISSION_DENIED");
    const body = JSON.parse(init.body);
    if ((body.dimensions || [])[0] === "query") return jsonOk(GSC_QUERY_ROWS);
    if (body.startDate === "2026-10-03") return jsonOk({ rows: [totals.current] });
    return jsonOk({ rows: [totals.prior] });
  };
}

function baseDeps(over = {}) {
  return {
    env: { GA4_PROPERTY_ID: "123456789", GOOGLE_SEARCH_CONSOLE_SITE_URL: "sc-domain:sitesinc.co" },
    keyFileOk: true,
    now: () => new Date("2026-11-01T12:00:00Z"),
    getGaToken: async () => "ga-token",
    getGscToken: async () => "gsc-token",
    readSiteflowRevenue: async () => [],
    ...over,
  };
}

test("parseGscRates reads ctr + position from the totals row; empty input is zeroes", () => {
  assert.deepEqual(parseGscRates({ rows: [{ clicks: 10, impressions: 100, ctr: 0.1, position: 3.5 }] }), {
    ctr: 0.1,
    position: 3.5,
  });
  assert.deepEqual(parseGscRates({}), { ctr: 0, position: 0 });
  assert.deepEqual(parseGscRates(undefined), { ctr: 0, position: 0 });
});

test("parseGscQueryRows carries all four numbers, ranked by clicks with click shares", () => {
  const rows = parseGscQueryRows(GSC_QUERY_ROWS);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(({ label, clicks, impressions, ctr, position }) => ({ label, clicks, impressions, ctr, position })),
    [
      { label: "plumber near me", clicks: 120, impressions: 2000, ctr: 0.06, position: 4.2 },
      { label: "website design", clicks: 31, impressions: 400, ctr: 0.0775, position: 6.8 },
    ]
  );
  assert.ok(Math.abs(rows[0].share - 120 / 151) < 1e-9);
  assert.ok(Math.abs(rows[1].share - 31 / 151) < 1e-9);
  assert.deepEqual(parseGscQueryRows({}), []);
  assert.deepEqual(parseGscQueryRows(undefined), []);
});

test("formatRatePct renders a stored fraction as a percentage", () => {
  assert.equal(formatRatePct(0.0443), "4.4%");
  assert.equal(formatRatePct(0.06), "6.0%");
  assert.equal(formatRatePct(0), "0.0%");
  assert.equal(formatRatePct(null), "—");
});

test("CTR + position land as KPIs with prior-period change; position improvement reads as improvement", async () => {
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl: makeFetch(IMPROVING) }));
  assert.equal(res.sources.gsc, "ok");
  // CTR: value is the current rate, change is the percent change of the rate.
  assert.equal(res.metrics.ctr.available, true);
  assert.equal(res.metrics.ctr.source, "gsc");
  assert.ok(Math.abs(res.metrics.ctr.value - 0.0443) < 1e-12);
  assert.ok(Math.abs(res.metrics.ctr.changePct - percentChange(0.0443, 0.0364)) < 1e-9);
  // Position improved 8.2 → 5.1: changePct is negative AND lowerIsBetter is set —
  // that combination is what the dashboard paints as a good (green) change.
  assert.equal(res.metrics.position.available, true);
  assert.equal(res.metrics.position.value, 5.1);
  assert.ok(Math.abs(res.metrics.position.changePct - percentChange(5.1, 8.2)) < 1e-9);
  assert.ok(res.metrics.position.changePct < 0);
  assert.equal(res.metrics.position.lowerIsBetter, true);
  // No other metric carries the flipped direction.
  assert.equal(res.metrics.visitors.lowerIsBetter, undefined);
  assert.equal(res.metrics.ctr.lowerIsBetter, undefined);
  assert.equal(res.metrics.clicks.lowerIsBetter, undefined);
  // Existing GSC numbers are untouched.
  assert.equal(res.metrics.clicks.value, 930);
  assert.equal(res.metrics.impressions.value, 21000);
});

test("a worsening position is not flagged as improvement", async () => {
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl: makeFetch(WORSENING_POSITION) }));
  assert.equal(res.metrics.position.value, 9.4);
  assert.ok(res.metrics.position.changePct > 0);
  assert.equal(res.metrics.position.lowerIsBetter, true);
});

test("per-query rows ride the report with full depth while topQueries keeps its ranked shape", async () => {
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl: makeFetch(IMPROVING) }));
  assert.equal(res.queryRows.length, 2);
  assert.deepEqual(res.queryRows[0], {
    label: "plumber near me",
    clicks: 120,
    impressions: 2000,
    ctr: 0.06,
    position: 4.2,
    share: 120 / 151,
  });
  assert.equal(res.queryRows[1].position, 6.8);
  // Ranked clicks view (other consumers) is unchanged in shape and order.
  assert.equal(res.topQueries[0].label, "plumber near me");
  assert.equal(res.topQueries[0].value, 120);
  assert.deepEqual(Object.keys(res.topQueries[0]).sort(), ["label", "share", "value"]);
});

test("Rec #1 is untouched: conversions and the Stripe overlay still land", async () => {
  const ledger = [
    { kind: "payment", amountCents: 12900, currency: "usd", at: "2026-10-15T10:00:00.000Z", livemode: true },
    { kind: "payment", amountCents: 50000, currency: "usd", at: "2026-10-15T11:00:00.000Z", livemode: false },
  ];
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    baseDeps({ fetchImpl: makeFetch(IMPROVING), readSiteflowRevenue: async () => ledger })
  );
  assert.equal(res.metrics.conversions.tracked, true);
  assert.equal(res.metrics.conversions.value, 46);
  assert.equal(res.topEvents[0].label, "generate_lead");
  assert.ok(res.collectedRevenue);
  assert.equal(res.collectedRevenue.amount, 129);
  assert.equal(res.metrics.revenue.value, 540);
});

test("a GSC failure degrades the new KPIs and query rows cleanly while GA4 still reports", async () => {
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    baseDeps({ fetchImpl: makeFetch(IMPROVING, { gscFails: true }) })
  );
  assert.equal(res.sources.gsc, "error");
  assert.equal(res.metrics.ctr.available, false);
  assert.equal(res.metrics.ctr.value, null);
  assert.equal(res.metrics.position.available, false);
  assert.equal(res.metrics.position.value, null);
  assert.equal(res.metrics.position.lowerIsBetter, true);
  assert.equal(res.metrics.impressions.available, false);
  assert.equal(res.metrics.clicks.available, false);
  assert.deepEqual(res.queryRows, []);
  assert.deepEqual(res.topQueries, []);
  assert.equal(res.sources.ga4, "ok");
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.metrics.conversions.value, 46);
  assert.equal(res.live, true);
});
