// Competitor crawler: top-3 search, crawl, weaknesses, prompt injection.  node --test (Node >= 22.6, strip-types)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);
const { default: test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const C = await import("../lib/factory/flip/competitors.ts");

const thin = `<html><title>ARV calc</title><body><h1>ARV</h1><p>${"word ".repeat(300)} updated 2019</p></body></html>`;
const rich = `<html><title>ARV Calculator guide</title><body><h1>ARV</h1><h2>What is ARV?</h2><h2>Example</h2><h2>FAQ</h2><h2>How do comps work?</h2><h2>Is the 70% rule safe?</h2><p>${"text ".repeat(1200)} 2026 Get started today</p><form><input></form></body></html>`;
const fakeFetch = async (url, init) => {
  if (url.startsWith("https://google.serper.dev")) {
    assert.equal(JSON.parse(init.body).q, "ARV Calculator");
    return { ok: true, status: 200, json: async () => ({ organic: [
      { link: "https://www.youtube.com/watch?v=1" }, { link: "https://a.com/arv" }, { link: "https://a.com/other" },
      { link: "https://b.com/arv" }, { link: "https://c.com/arv" }, { link: "https://d.com/arv" } ] }), text: async () => "" };
  }
  if (url === "https://c.com/arv") return { ok: false, status: 403, text: async () => "", json: async () => ({}) };
  return { ok: true, status: 200, text: async () => (url.includes("a.com") ? thin : rich), json: async () => ({}) };
};

test("no provider and no manual URLs: never invents competitors", async () => {
  const a = await C.analyzeCompetitors("ARV Calculator", { env: {}, fetchImpl: async () => { throw new Error("should not fetch"); } });
  assert.equal(a.status, "no_provider"); assert.equal(a.competitors.length, 0);
  assert.equal(C.competitorPromptBlock(a), "");
});

test("serper top 3 (dedupe hosts, skip video/social), crawl, weaknesses, gaps", async () => {
  const a = await C.analyzeCompetitors("ARV Calculator", { env: { SERPER_API_KEY: "x" }, fetchImpl: fakeFetch, nowYear: 2026 });
  assert.equal(a.provider, "serper"); assert.equal(a.status, "ok");
  assert.deepEqual(a.competitors.map((c) => c.url), ["https://a.com/arv", "https://b.com/arv", "https://c.com/arv"]);
  assert.ok(a.weaknesses.some((w) => w.startsWith("a.com: thin content")));
  assert.ok(a.weaknesses.some((w) => /a\.com: possibly outdated \(latest year mentioned 2019\)/.test(w)));
  assert.ok(a.weaknesses.some((w) => /a\.com: weak or missing call to action/.test(w)));
  assert.ok(a.weaknesses.some((w) => /c\.com: could not be crawled/.test(w)));
  assert.ok(!a.weaknesses.some((w) => w.startsWith("b.com: thin")));
  assert.ok(a.gaps.includes("taxes on flip profits"));
  const block = C.competitorPromptBlock(a);
  assert.match(block, /Their weaknesses/); assert.match(block, /taxes on flip profits/); assert.match(block, /How do comps work\?/);
});

test("manual URLs override search; brave provider is recognized", async () => {
  const a = await C.analyzeCompetitors("x", { env: {}, fetchImpl: fakeFetch, manualUrls: ["https://b.com/arv"] });
  assert.equal(a.provider, "manual"); assert.equal(a.competitors.length, 1);
  assert.equal(C.searchProvider({ BRAVE_SEARCH_API_KEY: "k" }).id, "brave");
});

test("writer feeds competitor analysis into the LLM prompt and stores it on the draft", async () => {
  const W = await import("../lib/factory/flip/writer.ts");
  const a = await C.analyzeCompetitors("ARV Calculator", { env: { SERPER_API_KEY: "x" }, fetchImpl: fakeFetch, nowYear: 2026 });
  let sent = "";
  const llmFetch = async (_u, init) => { sent = JSON.parse(init.body).messages.map((m) => m.content).join("\n");
    const j = { model: "fake", choices: [{ message: { content: "# ARV\n\n" + "good words here ".repeat(400) } }] };
    return { ok: true, status: 200, headers: new Headers(), json: async () => j, text: async () => JSON.stringify(j) }; };
  const state = { niche: "house flipping / real-estate investing", businessName: "FlipRadar", domain: "flipradar.co", contentTarget: { min: 900, max: 1500 } };
  const page = { slug: "arv-calculator", path: "/tools/arv-calculator", kind: "calculator", title: "ARV Calculator" };
  const g = await W.generateFlipPage(state, page, { env: { LLM_BASE_URL: "http://x/v1", LLM_MODEL: "m" }, fetchImpl: llmFetch, competitors: a });
  assert.match(sent, /Competitor research for "ARV Calculator"/); assert.match(sent, /a\.com: thin content/);
  assert.equal(g.competitors.status, "ok");
  assert.equal(W.competitorKeyword({ kind: "city", title: "Flipping Houses in Austin, TX: guide" }), "Flipping Houses in Austin, TX house flipping");
});
