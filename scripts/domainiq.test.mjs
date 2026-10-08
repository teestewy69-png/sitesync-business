// DomainIQ port parity: the in-process TypeScript engine must reproduce the real
// DomainIQ Python engine exactly (fixtures written by scripts/domainiq/export-domainiq.py).
// No network, no server, no keys.
//   node --test scripts/domainiq.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DOMAINIQ_DATA } from "../lib/domainiq/data.generated.ts";
import { createDomainIQEngine, pyRound2 } from "../lib/domainiq/engine.ts";
import {
  buildClientDomainSeed,
  suggestClientDomains,
  applyAvailabilityResults,
  rankByVerifiedAvailability,
  selectCandidate,
} from "../lib/domainiq/client.ts";

const golden = JSON.parse(readFileSync(new URL("./fixtures/domainiq-golden.json", import.meta.url), "utf8"));
const engine = createDomainIQEngine(DOMAINIQ_DATA);

function numeric(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Number(v)]));
}

function assertScoreMatches(actual, expected, where) {
  assert.equal(actual.total, Number(expected.total), `${where}: total`);
  assert.equal(actual.band, expected.band, `${where}: band`);
  assert.deepEqual(actual.subScores, numeric(expected.subScores), `${where}: subScores`);
  assert.deepEqual(actual.contributions, numeric(expected.contributions), `${where}: contributions`);
  assert.equal(actual.summary, expected.summary, `${where}: summary`);
  assert.equal(actual.explanation, expected.explanation, `${where}: explanation`);
  assert.deepEqual(actual.highlights, expected.highlights, `${where}: highlights`);
  assert.deepEqual(actual.concerns, expected.concerns, `${where}: concerns`);
  assert.equal(actual.nicheFit, expected.nicheFit === null ? null : Number(expected.nicheFit), `${where}: nicheFit`);
  assert.equal(actual.nicheKey, expected.nicheKey, `${where}: nicheKey`);
}

test("pyRound2 matches Python round(x, 2) incl. ties-to-even", () => {
  assert.equal(pyRound2(0.125), 0.12);
  assert.equal(pyRound2(0.375), 0.38);
  assert.equal(pyRound2(2.675), 2.67); // binary value is below the tie
  assert.equal(pyRound2(76.1), 76.1);
  assert.equal(pyRound2(-0.125), -0.12);
});

for (const item of golden.score) {
  test(`score parity: ${item.id} (${item.fullName})`, () => {
    const kw = item.kwargs;
    const actual = engine.score(item.fullName, {
      primaryKeyword: kw.primary_keyword,
      industry: kw.industry,
      nicheKey: kw.niche_key,
    });
    assertScoreMatches(actual, item.expected, item.id);
  });
}

for (const item of golden.generate) {
  test(`generate parity: ${item.id}`, () => {
    const req = item.request;
    const actual = engine.generate({
      keywords: req.keywords,
      niche: req.niche,
      industry: req.industry,
      style: req.style,
      tlds: req.tlds,
      count: req.count,
    });
    const expected = item.expected;
    assert.equal(actual.nicheKey, expected.nicheKey);
    assert.equal(actual.resolutionSource, expected.resolutionSource);
    assert.deepEqual(actual.engineKeywords, expected.engineKeywords);
    assert.deepEqual(actual.harvestWords, expected.harvestWords);
    assert.equal(actual.primaryKeyword, expected.primaryKeyword);
    assert.deepEqual(actual.generatedLabels, expected.generatedLabels, "engine candidate order");
    assert.equal(actual.rejectedCount, expected.rejectedCount);
    assert.deepEqual(
      actual.top.map((s) => s.fullName),
      expected.top.map((s) => s.fullName),
      "ranking"
    );
    actual.top.forEach((s, index) => {
      assertScoreMatches(s, expected.top[index], `${item.id}#${index} ${s.fullName}`);
      assert.equal(s.pattern, expected.top[index].pattern);
    });
  });
}

test("client seed: plumbing client in Phoenix, AZ", () => {
  const seed = buildClientDomainSeed({
    businessName: "Desert Flow Plumbing LLC",
    niche: "Plumbing",
    city: "Phoenix",
    state: "AZ",
  });
  assert.equal(seed.ok, true);
  assert.equal(seed.nicheKeyword, "plumbing");
  assert.equal(seed.cityToken, "phoenix");
  assert.equal(seed.businessToken, "desertflowplumbing");
  assert.equal(seed.distinctiveToken, "desertflow");
});

test("client seed: missing niche + business name is reported, not faked", () => {
  const seed = buildClientDomainSeed({ businessName: "", niche: "", city: "Austin", state: "TX" });
  assert.equal(seed.ok, false);
  assert.match(seed.reason, /niche|business/i);
});

test("suggestClientDomains: real scored candidates, local + brand, all unchecked", () => {
  const out = suggestClientDomains(engine, {
    businessName: "Desert Flow Plumbing",
    niche: "plumbing",
    city: "Phoenix",
    state: "AZ",
  });
  assert.equal(out.ok, true);
  assert.ok(out.candidates.length >= 8);
  const domains = out.candidates.map((c) => c.domain);
  assert.equal(new Set(domains).size, domains.length, "deduped");
  assert.ok(out.candidates.some((c) => c.source === "local" && c.domain.includes("phoenix")));
  assert.ok(out.candidates.some((c) => c.source === "brand"));
  for (const c of out.candidates) {
    assert.equal(c.availability, "unchecked");
    // Every score is the engine's own score for that exact name.
    const rescored = engine.score(c.domain, out.scoreContexts[c.source]);
    assert.equal(rescored.total, c.score, c.domain);
  }
  for (let i = 1; i < out.candidates.length; i += 1) {
    assert.ok(out.candidates[i - 1].score >= out.candidates[i].score, "sorted by score");
  }
});

test("availability merge + selection never imply a purchase", () => {
  const out = suggestClientDomains(engine, { businessName: "Desert Flow Plumbing", niche: "plumbing", city: "Phoenix", state: "AZ" });
  const first = out.candidates[0].domain;
  const merged = applyAvailabilityResults(out.candidates, [
    { domain: first, status: "registered", checkedAt: "2026-10-05T00:00:00.000Z", detail: "RDAP 200" },
  ]);
  assert.equal(merged[0].availability, "registered");
  assert.equal(merged[1].availability, "unchecked");
  const picked = selectCandidate(merged, merged[1].domain);
  assert.equal(picked.ok, true);
  assert.equal(picked.domainStatus, "selected");
  const bad = selectCandidate(merged, "not-a-candidate.com");
  assert.equal(bad.ok, false);
});

test("rankByVerifiedAvailability: verified-available first, unchecked never promoted", () => {
  const out = suggestClientDomains(engine, { businessName: "Valley Pro Plumbing", niche: "plumbing", city: "Phoenix", state: "AZ" }, { localCount: 18, brandCount: 18 });
  const pool = out.candidates;
  assert.ok(pool.length > 12);
  const low = pool[pool.length - 1].domain;
  const results = pool.slice(0, pool.length - 1).map((c) => ({ domain: c.domain, status: "registered", checkedAt: "t" }));
  results.push({ domain: low, status: "available", checkedAt: "t", detail: "RDAP 404 + no DNS NS records" });
  const ranked = rankByVerifiedAvailability(pool, results, { max: 12, keepUnavailable: 4 });
  assert.equal(ranked[0].domain, low, "available name leads even with a lower score");
  assert.equal(ranked[0].availability, "available");
  assert.ok(ranked.slice(1).every((c) => c.availability === "registered"));
  assert.ok(ranked.length <= 12);
  const none = rankByVerifiedAvailability(pool, [], { max: 12 });
  assert.ok(none.every((c) => c.availability === "unchecked"));
});
