// Website data sources (Rec #3): GA4 channel + city breakdowns in the same batch (no network).
//   node --test scripts/website-data-sources.test.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const { buildWebsiteDataReport, parseGaTopChannels, parseGaTopCities } = await import(
  "../lib/factory/website-data.ts"
);

function jsonOk(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => "" };
}

function jsonErr(status, text) {
  return { ok: false, status, json: async () => ({}), text: async () => text };
}

const CHANNEL_ROWS = [
  { dimensionValues: [{ value: "Organic Search" }], metricValues: [{ value: "800" }] },
  { dimensionValues: [{ value: "Direct" }], metricValues: [{ value: "300" }] },
  { dimensionValues: [{ value: "Organic Social" }], metricValues: [{ value: "180" }] },
];

// As GA4 returns them: an unplaced "(not set)" row and an empty label ride along.
const CITY_ROWS = [
  { dimensionValues: [{ value: "Walnut" }], metricValues: [{ value: "300" }] },
  { dimensionValues: [{ value: "(not set)" }], metricValues: [{ value: "120" }] },
  { dimensionValues: [{ value: "Diamond Bar" }], metricValues: [{ value: "90" }] },
  { dimensionValues: [{ value: "" }], metricValues: [{ value: "50" }] },
  { dimensionValues: [{ value: "West Covina" }], metricValues: [{ value: "60" }] },
];

/** GA reports aligned to whatever requests were actually sent (same fixture shape as Rec #1/#2). */
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
    if (dims.includes("sessionDefaultChannelGroup")) return { rows: CHANNEL_ROWS };
    if (dims.includes("city")) return { rows: CITY_ROWS };
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
      return jsonOk({ rows: [{ keys: ["website design"], clicks: 31, impressions: 400, ctr: 0.0775, position: 6.8 }] });
    }
    if (body.startDate === "2026-10-03") return jsonOk({ rows: [{ clicks: 930, impressions: 21000, ctr: 0.0443, position: 5.1 }] });
    return jsonOk({ rows: [{ clicks: 902, impressions: 24800, ctr: 0.0364, position: 8.2 }] });
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

test("parseGaTopChannels maps rows to label/value pairs", () => {
  assert.deepEqual(parseGaTopChannels({ rows: CHANNEL_ROWS }), [
    { label: "Organic Search", value: 800 },
    { label: "Direct", value: 300 },
    { label: "Organic Social", value: 180 },
  ]);
  assert.deepEqual(parseGaTopChannels({}), []);
  assert.deepEqual(parseGaTopChannels(undefined), []);
});

test("parseGaTopCities drops (not set) and empty labels, then caps at 8", () => {
  assert.deepEqual(parseGaTopCities({ rows: CITY_ROWS }), [
    { label: "Walnut", value: 300 },
    { label: "Diamond Bar", value: 90 },
    { label: "West Covina", value: 60 },
  ]);
  const tenValid = Array.from({ length: 10 }, (_, i) => ({
    dimensionValues: [{ value: `City ${i + 1}` }],
    metricValues: [{ value: String(100 - i) }],
  }));
  const capped = parseGaTopCities({ rows: tenValid });
  assert.equal(capped.length, 8);
  assert.equal(capped[0].label, "City 1");
  assert.equal(capped[7].label, "City 8");
  assert.deepEqual(parseGaTopCities({}), []);
  assert.deepEqual(parseGaTopCities(undefined), []);
});

test("channels + cities land ranked with shares, riding in the same single batch as everything else", async () => {
  const calls = [];
  const res = await buildWebsiteDataReport(
    { preset: "30d" },
    baseDeps({ fetchImpl: makeFetch(async (body) => jsonOk({ reports: gaReportsFor(body.requests) }), calls) })
  );
  assert.equal(res.sources.ga4, "ok");
  // Exactly one GA batch call: the breakdowns ride along, they are not extra round-trips.
  assert.equal(calls.length, 1);
  const requests = calls[0].requests;
  const channelsReq = requests.find((r) => (r.dimensions || []).some((d) => d.name === "sessionDefaultChannelGroup"));
  assert.ok(channelsReq, "channels request present in the batch");
  assert.deepEqual(channelsReq.metrics, [{ name: "totalUsers" }]);
  assert.equal(channelsReq.limit, 8);
  const citiesReq = requests.find((r) => (r.dimensions || []).some((d) => d.name === "city"));
  assert.ok(citiesReq, "cities request present in the batch");
  assert.deepEqual(citiesReq.metrics, [{ name: "totalUsers" }]);
  assert.equal(citiesReq.limit, 10);

  // Ranked with shares over the listed rows.
  assert.deepEqual(
    res.topChannels.map((r) => r.label),
    ["Organic Search", "Direct", "Organic Social"]
  );
  assert.equal(res.topChannels[0].value, 800);
  assert.ok(Math.abs(res.topChannels[0].share - 800 / 1280) < 1e-9);
  assert.ok(Math.abs(res.topChannels[2].share - 180 / 1280) < 1e-9);

  // Cities: junk rows are gone BEFORE shares, so Walnut's share is of placed visits only.
  assert.deepEqual(
    res.topCities.map((r) => r.label),
    ["Walnut", "Diamond Bar", "West Covina"]
  );
  assert.ok(Math.abs(res.topCities[0].share - 300 / 450) < 1e-9);
  assert.ok(Math.abs(res.topCities[1].share - 90 / 450) < 1e-9);
  assert.ok(Math.abs(res.topCities[2].share - 60 / 450) < 1e-9);

  // Rec #1 + #2 outputs are untouched.
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.metrics.conversions.value, 46);
  assert.equal(res.topEvents[0].label, "generate_lead");
  assert.equal(res.topPages[0].label, "/");
  assert.equal(res.metrics.position.value, 5.1);
  assert.equal(res.queryRows[0].label, "website design");
});

test("a batch failure implicating a breakdown dimension degrades to empty breakdown cards, core report intact", async () => {
  let gaCalls = 0;
  const fetchImpl = makeFetch(async (body) => {
    gaCalls += 1;
    if (JSON.stringify(body).includes("sessionDefaultChannelGroup")) {
      return jsonErr(400, "INVALID_ARGUMENT: sessionDefaultChannelGroup is not a valid dimension for this property");
    }
    return jsonOk({ reports: gaReportsFor(body.requests) });
  });
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl }));
  assert.equal(gaCalls, 2);
  assert.equal(res.sources.ga4, "ok");
  assert.deepEqual(res.topChannels, []);
  assert.deepEqual(res.topCities, []);
  // The core report stands: KPIs, conversions, pages, events, queries all still land.
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.metrics.pageViews.value, 3410);
  assert.equal(res.metrics.conversions.tracked, true);
  assert.equal(res.metrics.conversions.value, 46);
  assert.equal(res.metrics.revenue.value, 540);
  assert.equal(res.topPages[0].label, "/");
  assert.equal(res.topEvents[0].label, "generate_lead");
  assert.equal(res.queryRows[0].label, "website design");
  assert.equal(res.live, true);
});

test("a city-dimension failure also degrades both breakdowns (they retry as one unit)", async () => {
  const fetchImpl = makeFetch(async (body) => {
    if (JSON.stringify(body).includes('"city"')) {
      return jsonErr(400, "INVALID_ARGUMENT: city is not a valid dimension for this property");
    }
    return jsonOk({ reports: gaReportsFor(body.requests) });
  });
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl }));
  assert.equal(res.sources.ga4, "ok");
  assert.deepEqual(res.topChannels, []);
  assert.deepEqual(res.topCities, []);
  assert.equal(res.metrics.visitors.value, 1280);
});

test("breakdown requests returning no rows are empty cards, not errors", async () => {
  const fetchImpl = makeFetch(async (body) =>
    jsonOk({
      reports: gaReportsFor(body.requests).map((report, i, all) => {
        const req = body.requests[i];
        const dims = (req.dimensions || []).map((d) => d.name);
        if (dims.includes("sessionDefaultChannelGroup") || dims.includes("city")) return { rows: [] };
        return report;
      }),
    })
  );
  const res = await buildWebsiteDataReport({ preset: "30d" }, baseDeps({ fetchImpl }));
  assert.equal(res.sources.ga4, "ok");
  assert.deepEqual(res.topChannels, []);
  assert.deepEqual(res.topCities, []);
  assert.equal(res.metrics.visitors.value, 1280);
  assert.equal(res.live, true);
});
