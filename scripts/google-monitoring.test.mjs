// Google monitoring: service-account token minting + GA4 report reader (no network, no real keys).
//   node --test scripts/google-monitoring.test.mjs        (needs Node >= 22.18 for TypeScript type stripping)
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const { createTokenProvider, signAssertion, parseServiceAccountKey, SCOPE_ANALYTICS, SCOPE_SEARCH_CONSOLE } = await import(
  "../lib/factory/google-auth.ts"
);
const { fetchGaSummary, parseGaReport, normalizePropertyId, gaMissing } = await import("../lib/factory/analytics-report.ts");
const { gscConfigured, gscCredentialPresent, resolveGscToken, inspectUrl } = await import("../lib/factory/search-console.ts");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const keyJson = JSON.stringify({ client_email: "factory@example.iam.gserviceaccount.com", private_key: privateKey });

function tokenResponse(token, expiresIn = 3600) {
  return { ok: true, status: 200, json: async () => ({ access_token: token, expires_in: expiresIn }), text: async () => "" };
}

function provider(opts = {}) {
  const calls = [];
  let clock = opts.start ?? 1_700_000_000_000;
  let n = 0;
  const p = createTokenProvider({
    keyFile: () => opts.keyFile ?? "fake-key.json",
    readFile: () => opts.raw ?? keyJson,
    now: () => clock,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (opts.fail) return { ok: false, status: 400, text: async () => '{"error":"invalid_grant"}', json: async () => ({}) };
      return tokenResponse(`tok-${++n}`, opts.expiresIn ?? 3600);
    },
  });
  return { p, calls, advance: (ms) => (clock += ms) };
}

test("signAssertion makes a valid RS256 JWT with the right claims", () => {
  const key = parseServiceAccountKey(keyJson);
  const jwt = signAssertion(key, SCOPE_SEARCH_CONSOLE, 1_700_000_000_000);
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(c, "base64url"));
  assert.equal(claims.iss, "factory@example.iam.gserviceaccount.com");
  assert.equal(claims.scope, SCOPE_SEARCH_CONSOLE);
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.exp - claims.iat, 3600);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${h}.${c}`);
  assert.equal(verifier.verify(publicKey, Buffer.from(s, "base64url")), true);
});

test("token is minted once, cached, then refreshed before expiry", async () => {
  const { p, calls, advance } = provider();
  assert.equal(await p.getToken(SCOPE_SEARCH_CONSOLE), "tok-1");
  assert.equal(await p.getToken(SCOPE_SEARCH_CONSOLE), "tok-1");
  assert.equal(calls.length, 1);
  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  assert.equal(body.get("assertion").split(".").length, 3);
  advance(30 * 60_000);
  assert.equal(await p.getToken(SCOPE_SEARCH_CONSOLE), "tok-1", "still fresh at 30 min");
  advance(30 * 60_000); // 60 min: inside the 1-minute skew window -> refresh
  assert.equal(await p.getToken(SCOPE_SEARCH_CONSOLE), "tok-2");
  assert.equal(calls.length, 2);
});

test("scopes are cached separately and concurrent calls share one request", async () => {
  const { p, calls } = provider();
  const [a, b] = await Promise.all([p.getToken(SCOPE_ANALYTICS), p.getToken(SCOPE_ANALYTICS)]);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
  await p.getToken(SCOPE_SEARCH_CONSOLE);
  assert.equal(calls.length, 2);
});

test("token errors never leak key material", async () => {
  const bad = provider({ fail: true });
  await assert.rejects(bad.p.getToken(SCOPE_ANALYTICS), (e) => /400/.test(e.message) && !e.message.includes("PRIVATE KEY"));
  const garbage = provider({ raw: "not json" });
  await assert.rejects(garbage.p.getToken(SCOPE_ANALYTICS), /not valid JSON/);
  const missing = provider({ raw: JSON.stringify({ client_email: "x" }) });
  await assert.rejects(missing.p.getToken(SCOPE_ANALYTICS), /missing client_email or private_key/);
  const noPath = provider({ keyFile: "" });
  await assert.rejects(noPath.p.getToken(SCOPE_ANALYTICS), /GOOGLE_SERVICE_ACCOUNT_KEY_FILE is not set/);
});

test("Search Console: manual access token overrides, config needs site url + a credential", async () => {
  const saved = { ...process.env };
  try {
    delete process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;
    delete process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    assert.equal(gscConfigured(), false);
    assert.equal(gscCredentialPresent(), false);
    process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN = "manual-token";
    assert.equal(gscCredentialPresent(), true);
    assert.equal(gscConfigured(), false, "site url still required");
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = "sc-domain:sitesinc.co";
    assert.equal(gscConfigured(), true);
    assert.equal(await resolveGscToken(), "manual-token");
    // A key path that does not exist is not a credential.
    delete process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE = "Z:/definitely/not/here.json";
    assert.equal(gscConfigured(), false);
    const res = await inspectUrl("https://sitesinc.co/");
    assert.equal(res.state, "not_submitted");
    assert.equal(res.source, "not_configured");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("Search Console inspectUrl sends the manual token as a bearer header", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  try {
    process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN = "manual-token";
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL = "sc-domain:sitesinc.co";
    let seen;
    globalThis.fetch = async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => ({ inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", indexingState: "INDEXING_ALLOWED" } } }) };
    };
    const res = await inspectUrl("https://sitesinc.co/");
    assert.equal(seen.init.headers.Authorization, "Bearer manual-token");
    assert.equal(JSON.parse(seen.init.body).siteUrl, "sc-domain:sitesinc.co");
    assert.equal(res.state, "indexed");
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("GA4: property id normalisation and not-connected states", async () => {
  assert.equal(normalizePropertyId("properties/123456789"), "123456789");
  assert.equal(normalizePropertyId(" 123456789 "), "123456789");
  assert.equal(normalizePropertyId("G-0XHXXSSB1N"), "", "measurement id is not a property id");
  assert.deepEqual(gaMissing({}, false), ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_KEY_FILE"]);
  assert.deepEqual(gaMissing({ GA4_PROPERTY_ID: "123456789" }, false), ["GOOGLE_SERVICE_ACCOUNT_KEY_FILE"]);
  assert.deepEqual(gaMissing({ GA4_PROPERTY_ID: "123456789" }, true), []);
  let called = false;
  const res = await fetchGaSummary({ env: {}, keyFileOk: false, fetchImpl: async () => ((called = true), {}) });
  assert.equal(res.status, "not_connected");
  assert.deepEqual(res.missing, ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_KEY_FILE"]);
  assert.equal(called, false, "no request when not connected");
});

const gaBody = {
  rows: [
    { dimensionValues: [{ value: "/" }], metricValues: [{ value: "120" }, { value: "90" }, { value: "4" }] },
    { dimensionValues: [{ value: "/pricing" }], metricValues: [{ value: "30" }, { value: "25" }, { value: "2" }] },
  ],
  totals: [{ metricValues: [{ value: "150" }, { value: "110" }, { value: "6" }] }],
};

test("GA4: parses totals and top pages from a mocked runReport", async () => {
  let seen;
  const res = await fetchGaSummary({
    env: { GA4_PROPERTY_ID: "123456789" },
    keyFileOk: true,
    getToken: async (scope) => (assert.equal(scope, SCOPE_ANALYTICS), "ga-token"),
    now: () => new Date("2026-10-27T12:00:00Z"),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => gaBody, text: async () => "" };
    },
  });
  assert.equal(seen.url, "https://analyticsdata.googleapis.com/v1beta/properties/123456789:runReport");
  assert.equal(seen.init.headers.Authorization, "Bearer ga-token");
  const req = JSON.parse(seen.init.body);
  assert.deepEqual(req.metrics.map((m) => m.name), ["sessions", "totalUsers", "keyEvents"]);
  assert.equal(res.status, "ok");
  assert.equal(res.sessions, 150);
  assert.equal(res.users, 110);
  assert.equal(res.keyEvents, 6);
  assert.equal(res.days, 28);
  assert.deepEqual(res.topPages[0], { path: "/", sessions: 120, keyEvents: 4 });
  assert.equal(res.fetchedAt, "2026-10-27T12:00:00.000Z");
});

test("GA4: empty report is zeros, API failure and token failure become error states", async () => {
  const empty = parseGaReport({}, 28, "123456789", "t");
  assert.equal(empty.status, "ok");
  assert.equal(empty.sessions, 0);
  assert.deepEqual(empty.topPages, []);

  const base = { env: { GA4_PROPERTY_ID: "123456789" }, keyFileOk: true, getToken: async () => "t" };
  const denied = await fetchGaSummary({ ...base, fetchImpl: async () => ({ ok: false, status: 403, text: async () => "PERMISSION_DENIED" }) });
  assert.equal(denied.status, "error");
  assert.match(denied.message, /403/);

  const tokenFail = await fetchGaSummary({ ...base, getToken: async () => { throw new Error("Google token request failed (400)."); }, fetchImpl: async () => ({}) });
  assert.equal(tokenFail.status, "error");
  assert.match(tokenFail.message, /token request failed/);
});
