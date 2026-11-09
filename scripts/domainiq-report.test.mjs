// DomainIQ report upgrade: recommendation pick, measured per-name rationale,
// variant risk flags (stubbed keyless availability), Porkbun price parsing +
// snapshot fallback, and rendering when nothing is available.
//   node --test scripts/domainiq-report.test.mjs   (Node >= 22.18 for TS type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { mkdtempSync, rmSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const path = (await import("node:path")).default;

// Isolate store writes (lib/persistence.ts resolves data/ from cwd at import time),
// same pattern as scripts/siteflow.test.mjs.
const REPO_CWD = process.cwd();
const TMP = mkdtempSync(path.join(tmpdir(), "domainiq-report-test-"));
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
process.env.SITESINC_STORE = "local";
process.chdir(TMP);

const report = await import("../lib/siteflow/generators/domainiq-report.ts");
const pricing = await import("../lib/siteflow/generators/domainiq-pricing.ts");
const { checkDomainsAvailability } = await import("../lib/domainiq/availability.ts");

test.after(() => {
  process.chdir(REPO_CWD);
  rmSync(TMP, { recursive: true, force: true });
});

const SEED = {
  businessName: "Sunrise Plumbing",
  niche: "plumbing",
  city: "Walnut",
  state: "CA",
  cityToken: "walnut",
  nicheKeyword: "plumbing",
  businessToken: "sunriseplumbing",
  distinctiveToken: "sunrise",
};

function cand(over = {}) {
  return {
    domain: "example.com",
    label: "example",
    tld: "com",
    score: 50,
    band: "moderate",
    source: "local",
    pattern: "test",
    summary: "A candidate.",
    explanation: "Explanation.",
    highlights: [],
    concerns: [],
    subScores: {
      brandability: 50,
      commercial_value: 60,
      market_demand: 40,
      domain_quality: 55,
      flip_potential: 30,
      risk_penalty: 5,
    },
    nicheKey: "plumbing",
    availability: "unchecked",
    ...over,
  };
}

const SNAPSHOT_TABLE = { prices: { ...pricing.PORKBUN_PRICE_SNAPSHOT }, source: "snapshot", asOf: pricing.PORKBUN_SNAPSHOT_DATE };

function renderArgs(over = {}) {
  return {
    seed: SEED,
    candidates: [],
    availabilityChecked: 1,
    checkedAt: "2026-11-08T12:00:00.000Z",
    variantFlags: new Map(),
    variantStatus: new Map(),
    variantCheckedCount: 0,
    prices: SNAPSHOT_TABLE,
    origin: "https://sitesinc.co",
    ...over,
  };
}

/* ------------------------------ recommendation ------------------------------ */

test("recommendation picks the highest-scoring AVAILABLE candidate, not the top score overall", () => {
  const taken = cand({ domain: "bestname.com", label: "bestname", score: 92, band: "excellent", availability: "registered" });
  const availHigh = cand({ domain: "goodname.com", label: "goodname", score: 84, band: "strong", availability: "available" });
  const availLow = cand({ domain: "okname.com", label: "okname", score: 79, band: "strong", availability: "available" });
  const rec = report.pickRecommendation([taken, availLow, availHigh]);
  assert.equal(rec.pick?.domain, "goodname.com");
  assert.equal(rec.runnerUp?.domain, "okname.com");
  assert.equal(rec.availableCount, 2);

  const html = report.buildDomainReportHtml(renderArgs({ candidates: [taken, availHigh, availLow] }));
  assert.match(html, /Our pick: <strong>goodname\.com<\/strong>/);
  assert.match(html, /Runner-up: <strong>okname\.com<\/strong>/);
});

/* -------------------------------- rationale --------------------------------- */

test("rationale is computed per candidate: keyword fit vs hyphen/digit/length downsides", () => {
  const local = cand({ domain: "walnutplumbing.com", label: "walnutplumbing", source: "local" });
  const messy = cand({ domain: "best-plumbing4less.com", label: "best-plumbing4less", source: "brand" });
  const a = report.candidateRationale(local, SEED).map((f) => f.text);
  const b = report.candidateRationale(messy, SEED).map((f) => f.text);
  assert.notDeepEqual(a, b);
  assert.ok(a.some((t) => t.includes("includes your city (Walnut)")), a.join(" | "));
  assert.ok(a.some((t) => t.includes('includes your trade keyword "plumbing"')), a.join(" | "));
  assert.ok(b.some((t) => t.includes("hyphen")), b.join(" | "));
  assert.ok(b.some((t) => t.includes("digit")), b.join(" | "));
  assert.ok(b.some((t) => t.includes("long - 18 characters")), b.join(" | "));
  // No invented claims: the messy name must not be credited with the city fit it lacks.
  assert.ok(!b.some((t) => t.includes("includes your city")), b.join(" | "));
});

test("rationale flags double letters and plural endings only when present", () => {
  const dbl = cand({ domain: "bellpros.com", label: "bellpros" });
  const facts = report.candidateRationale(dbl, SEED).map((f) => f.text);
  assert.ok(facts.some((t) => t.includes('double "l"')), facts.join(" | "));
  assert.ok(facts.some((t) => t.includes('ends in "s"')), facts.join(" | "));
  const clean = cand({ domain: "belpro.com", label: "belpro" });
  const cleanFacts = report.candidateRationale(clean, SEED).map((f) => f.text);
  assert.ok(!cleanFacts.some((t) => t.includes("double")), cleanFacts.join(" | "));
  assert.ok(!cleanFacts.some((t) => t.includes('ends in "s"')), cleanFacts.join(" | "));
});

/* ------------------------------- risk flags --------------------------------- */

test("variants are derived transparently from the label and seed tokens", () => {
  const c = cand({ domain: "sunriseplumbing.com", label: "sunriseplumbing" });
  const variants = report.domainVariants(c, SEED);
  const byDomain = new Map(variants.map((v) => [v.domain, v.kind]));
  assert.equal(byDomain.get("sunriseplumbing.net"), "other_tld");
  assert.equal(byDomain.get("sunriseplumbing.org"), "other_tld");
  assert.equal(byDomain.get("sunriseplumbings.com"), "plural");
  assert.equal(byDomain.get("sunrise-plumbing.com"), "hyphen");
  assert.ok(!byDomain.has("sunriseplumbing.com"), "never flags the candidate itself");
});

test("risk flags appear when a variant checks back registered (stubbed availability)", async () => {
  const c = cand({ domain: "sunriseplumbing.com", label: "sunriseplumbing", availability: "available" });
  const variants = report.domainVariants(c, SEED);
  const stubFetch = async (url) => {
    const u = String(url);
    if (u.includes("cloudflare-dns.com")) return { ok: true, status: 200, json: async () => ({ Answer: [] }) };
    if (u.includes("rdap.verisign.com")) {
      // Only the .net look-alike is registered.
      return { ok: false, status: u.includes("sunriseplumbing.net") ? 200 : 404, json: async () => ({}) };
    }
    throw new Error(`unexpected fetch: ${u}`);
  };
  const results = await checkDomainsAvailability(
    variants.map((v) => v.domain),
    { fetchImpl: stubFetch, timeoutMs: 1000 }
  );
  const byDomain = new Map(results.map((r) => [r.domain, r]));
  assert.equal(byDomain.get("sunriseplumbing.net")?.status, "registered");
  const flags = report.flagsFromVariantResults(variants, byDomain);
  assert.equal(flags.length, 1);
  assert.match(flags[0], /sunriseplumbing\.net is already registered/);

  const html = report.buildDomainReportHtml(
    renderArgs({
      candidates: [c],
      variantFlags: new Map([[c.domain, flags]]),
      variantStatus: byDomain,
      variantCheckedCount: 1,
    })
  );
  assert.match(html, /Risk flags:/);
  assert.match(html, /sunriseplumbing\.net is already registered/);
  assert.match(html, /not legal advice/);
  assert.match(html, /does not search trademarks/);
});

/* --------------------------------- pricing ---------------------------------- */

test("porkbun pricing page parses into per-TLD first-year prices", () => {
  const html = `<a class="black priceDisplayHomeLink" data-tld="com" href="/tld/com"> .COM from $11.81 </a>
<a class="black priceDisplayHomeLink" data-tld="net" href="/tld/net"> .NET from $12.52 </a>
<a class="black priceDisplayHomeLink" data-tld="org" href="/tld/org"> .ORG from $7.98 </a>`;
  assert.deepEqual(pricing.parsePorkbunPricingHtml(html), { com: 11.81, net: 12.52, org: 7.98 });
  assert.deepEqual(pricing.parsePorkbunPricingHtml("<html>challenge</html>"), {});
});

test("price lookup falls back to the labeled snapshot when the live fetch fails", async () => {
  const table = await pricing.getPorkbunTldPrices({
    fetchImpl: async () => {
      throw new Error("bot challenge");
    },
  });
  assert.equal(table.source, "snapshot");
  assert.equal(table.asOf, pricing.PORKBUN_SNAPSHOT_DATE);
  assert.equal(table.prices.com, pricing.PORKBUN_PRICE_SNAPSHOT.com);
  assert.equal(pricing.formatTldPrice(table, "com"), `$${pricing.PORKBUN_PRICE_SNAPSHOT.com.toFixed(2)}`);
  assert.equal(pricing.formatTldPrice(table, "ai"), undefined);
});

/* --------------------------- nothing available ------------------------------ */

test("report still renders honestly when no candidate is available", () => {
  const a = cand({ domain: "takenone.com", label: "takenone", score: 88, band: "excellent", availability: "registered" });
  const b = cand({ domain: "takentwo.com", label: "takentwo", score: 71, band: "strong", availability: "registered" });
  const html = report.buildDomainReportHtml(renderArgs({ candidates: [a, b] }));
  assert.match(html, /No clear pick this time/);
  assert.match(html, /closest miss is <strong>takenone\.com<\/strong>/);
  assert.match(html, /takenone\.com/);
  assert.match(html, /takentwo\.com/);
  assert.match(html, /Skip unless you own them/);
  assert.match(html, /Sitesinc does not buy or hold domains for you/);
});

/* --------------------------------- end to end -------------------------------- */

test("generateDomainIQReport end to end with stubbed network: pick, prices, measured facts", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("porkbun.com")) throw new Error("blocked in test");
    if (u.includes("rdap.verisign.com")) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes("cloudflare-dns.com")) return { ok: true, status: 200, json: async () => ({ Answer: [] }) };
    throw new Error(`unexpected fetch: ${u}`);
  };
  try {
    const html = await report.generateDomainIQReport(
      { businessName: "Sunrise Plumbing", niche: "plumbing", city: "Walnut", state: "CA" },
      { origin: "https://sitesinc.co" }
    );
    assert.match(html, /<h2>Recommendation<\/h2>/);
    assert.match(html, /Our pick: <strong>/);
    assert.match(html, /Est\. first year/);
    assert.match(html, /\$11\.81/);
    assert.match(html, /snapshot of Porkbun's public price list dated 2026-11-08/);
    assert.match(html, /registry-premium names can cost much more at checkout/i);
    assert.match(html, /Measured:/);
    assert.match(html, /<h2>Next steps<\/h2>/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
