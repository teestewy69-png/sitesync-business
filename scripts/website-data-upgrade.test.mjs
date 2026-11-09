// Website data upgrade (Rec #1): GA4 key-event conversions + SiteFlow collected-revenue overlay (no network).
//   node --test scripts/website-data-upgrade.test.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const { buildWebsiteDataReport, parseGaKeyEvents, parseGaTopEvents, sumCollectedRevenue } = await import(
  "../lib/factory/website-data.ts"
);

function jsonOk(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
}

function jsonErr(status, text) {
  return { ok: false, status, json: async () => ({}), text: async () => text };
}

/** Build batchRunReports results aligned to whatever requests were actually sent. */
function reportsFor(requests) {
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
      return {
        rows: [
          { dimensionValues: [{ value: "/" }], metricValues: [{ value: "200" }] },
          { dimensionValues: [{ value: "/contact" }], metricValues: [{ value: "90" }] },
        ],
      };
    }
    if (dims.includes("eventName")) {
      return {
        rows: [
          { dimensionValues: [{ value: "generate_lead" }], metricValues: [{ value: "30" }] },
          { dimensionValues: [{ value: "phone_call" }], metricValues: [{ value: "16" }] },
        ],
      };
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

function makeFetch(gaHandler, calls) {
  return async (url, init) => {
    const u = String(url);
    if (u.includes("analyticsdata")) {
      const body = JSON.parse(init.body);
      if (calls) calls.push(body);
      return gaHandler(body);
    }
    const body = JSON.parse(init.body);
    if ((body.dimensions || [])[0] === "query") {
      return jsonOk({ rows: [{ keys: ["website design"], clicks: 31, impressions: 400 }] });
    }
    if (body.startDate === "2026-10-03") return jsonOk({ rows: [{ clicks: 902, impressions: 24800 }] });
    return jsonOk({ rows: [{ clicks: 930, impressions: 21000 }] });
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

test("parseGaKeyEvents reads the shifted metric index and the totals fallback", () => {
  const withRevenue = {
    rows: [
      { dimensionValues: [{ value: "current" }], metricValues: [{ value: "10" }, { value: "20" }, { value: "30" }, { value: "46" }] },
      { dimensionValues: [{ value: "prior" }], metricValues: [{ value: "9" }, { value: "18" }, { value: "25" }, { value: "38" }] },
    ],
  };
  assert.deepEqual(parseGaKeyEvents(withRevenue, 3), { current: 46, prior: 38 });
  const noRevenue = {
    rows: [
      { dimensionValues: [{ value: "current" }], metricValues: [{ value: "10" }, { value: "20" }, { value: "46" }] },
      { dimensionValues: [{ value: "date_range_1" }], metricValues: [{ value: "9" }, { value: "18" }, { value: "38" }] },
    ],
  };
  assert.deepEqual(parseGaKeyEvents(noRevenue, 2), { current: 46, prior: 38 });
  assert.deepEqual(parseGaKeyEvents({ totals: [{ metricValues: [{ value: "1" }, { value: "2" }, { value: "3" }, { value: "7" }] }] }, 3), {
    current: 7,
    prior: 0,
  });
  assert.deepEqual(parseGaKeyEvents(undefined), { current: 0, prior: 0 });
  assert.deepEqual(parseGaTopEvents({ rows: [{ dimensionValues: [{ value: "call" }], metricValues: [{ value: "5" }] }] }), [
    { label: "call", value: 5 },
  ]);
});

test("keyEvents totals land as the conversions metric with % change; top events rank by share", async () => {
  const calls = [];
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    baseDeps({ fetchImpl: makeFetch(async (body) => jsonOk({ reports: reportsFor(body.requests) }), calls) })
  );
  assert.equal(res.sources.ga4, "ok");
  assert.equal(res.metrics.conversions.tracked, true);
  assert.equal(res.metrics.conversions.available, true);
  assert.equal(res.metrics.conversions.value, 46);
  assert.ok(Math.abs(res.metrics.conversions.changePct - ((46 - 38) / 38) * 100) < 1e-9);
  assert.equal(res.topEvents.length, 2);
  assert.equal(res.topEvents[0].label, "generate_lead");
  assert.equal(res.topEvents[0].value, 30);
  assert.ok(Math.abs(res.topEvents[0].share - 30 / 46) < 1e-9);
  assert.equal(res.topEvents[1].label, "phone_call");
  // The request itself must ask for keyEvents in totals and an eventName breakdown.
  const first = calls[0];
  const totalsReq = first.requests.find((r) => (r.dateRanges || []).length === 2);
  assert.ok(totalsReq.metrics.some((m) => m.name === "keyEvents"));
  assert.ok(first.requests.some((r) => (r.dimensions || []).some((d) => d.name === "eventName")));
  // Existing metrics are untouched.
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.metrics.revenue.value, 540);
});

test("a keyEvents INVALID_ARGUMENT degrades conversions to untracked while the rest of GA4 succeeds", async () => {
  let gaCalls = 0;
  const fetchImpl = makeFetch(async (body) => {
    gaCalls += 1;
    if (JSON.stringify(body).includes("keyEvents")) {
      return jsonErr(400, "INVALID_ARGUMENT: keyEvents is not a valid metric for this property");
    }
    return jsonOk({ reports: reportsFor(body.requests) });
  });
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl }));
  assert.equal(gaCalls, 2);
  assert.equal(res.sources.ga4, "ok");
  assert.equal(res.metrics.conversions.tracked, false);
  assert.equal(res.metrics.conversions.available, false);
  assert.equal(res.metrics.conversions.value, null);
  assert.deepEqual(res.topEvents, []);
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.metrics.pageViews.value, 3410);
  assert.equal(res.metrics.revenue.tracked, true);
  assert.equal(res.metrics.revenue.value, 540);
  assert.equal(res.live, true);
});

test("a purchaseRevenue INVALID_ARGUMENT keeps conversions (keyEvents index shifts to 2)", async () => {
  const fetchImpl = makeFetch(async (body) => {
    if (JSON.stringify(body).includes("purchaseRevenue")) {
      return jsonErr(400, "INVALID_ARGUMENT: purchaseRevenue is not a valid metric for this property");
    }
    return jsonOk({ reports: reportsFor(body.requests) });
  });
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl }));
  assert.equal(res.sources.ga4, "ok");
  assert.equal(res.metrics.revenue.tracked, false);
  assert.equal(res.metrics.conversions.tracked, true);
  assert.equal(res.metrics.conversions.value, 46);
  assert.equal(res.topEvents[0].label, "generate_lead");
  assert.equal(res.estimatedValue.status, "placeholder");
});

const LEDGER = [
  { kind: "payment", amountCents: 12900, currency: "usd", at: "2026-10-15T10:00:00.000Z", livemode: true },
  { kind: "payment", amountCents: 199500, currency: "usd", at: "2026-10-20T10:00:00.000Z", livemode: true },
  { kind: "refund", amountCents: -12900, currency: "usd", at: "2026-10-25T10:00:00.000Z", livemode: true },
  { kind: "payment", amountCents: 50000, currency: "usd", at: "2026-10-15T11:00:00.000Z", livemode: false },
  { kind: "refund", amountCents: -5000, currency: "usd", at: "2026-10-16T11:00:00.000Z", livemode: false },
  { kind: "payment", amountCents: 12900, currency: "usd", at: "2026-09-10T10:00:00.000Z", livemode: true },
  { kind: "payment", amountCents: 99900, currency: "usd", at: "2026-08-01T10:00:00.000Z", livemode: true },
  { kind: "payment", amountCents: 7000, currency: "eur", at: "2026-10-15T12:00:00.000Z", livemode: true },
];

test("sumCollectedRevenue nets refunds, excludes test mode, other currencies and out-of-range days", () => {
  assert.equal(sumCollectedRevenue(LEDGER, "2026-10-03", "2026-11-01"), 1995);
  assert.equal(sumCollectedRevenue(LEDGER, "2026-09-03", "2026-10-02"), 129);
  assert.equal(sumCollectedRevenue(LEDGER, "2026-10-15", "2026-10-15"), 129);
  assert.equal(sumCollectedRevenue([], "2026-10-03", "2026-11-01"), 0);
});

test("the Stripe overlay appears for the sitesinc site with current + prior amounts", async () => {
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    baseDeps({
      fetchImpl: makeFetch(async (body) => jsonOk({ reports: reportsFor(body.requests) })),
      readSiteflowRevenue: async () => LEDGER,
    })
  );
  assert.ok(res.collectedRevenue);
  assert.equal(res.collectedRevenue.amount, 1995);
  assert.equal(res.collectedRevenue.priorAmount, 129);
  assert.equal(res.collectedRevenue.start, "2026-10-03");
  assert.equal(res.collectedRevenue.end, "2026-11-01");
  // Never merged into the GA4 revenue metric.
  assert.equal(res.metrics.revenue.value, 540);
});

test("the Stripe overlay is absent for a client site and the ledger is never read", async () => {
  let ledgerReads = 0;
  const res = await buildWebsiteDataReport(
    { siteId: "client-1", preset: "30d" },
    baseDeps({
      findProject: async () => ({ id: "client-1", businessName: "Local Shop", ga4PropertyId: "999888777", gscSiteUrl: "sc-domain:local.shop" }),
      fetchImpl: makeFetch(async (body) => jsonOk({ reports: reportsFor(body.requests) })),
      readSiteflowRevenue: async () => {
        ledgerReads += 1;
        return LEDGER;
      },
    })
  );
  assert.equal(res.site.kind, "client");
  assert.equal(res.collectedRevenue, null);
  assert.equal(ledgerReads, 0);
  assert.equal(res.metrics.conversions.value, 46);
});

test("a failing ledger read degrades the overlay to null without breaking the report", async () => {
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    baseDeps({
      fetchImpl: makeFetch(async (body) => jsonOk({ reports: reportsFor(body.requests) })),
      readSiteflowRevenue: async () => {
        throw new Error("store down");
      },
    })
  );
  assert.equal(res.collectedRevenue, null);
  assert.equal(res.live, true);
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.metrics.conversions.value, 46);
});
