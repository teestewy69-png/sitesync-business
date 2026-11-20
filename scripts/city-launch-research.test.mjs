// City Launch research agent: scrapes sourced local notes (Wikipedia extract + the city's
// official site from its infobox) into the writers' VERIFIED LOCAL NOTES slot. The fetcher is
// stubbed — no live network.   node --test scripts/city-launch-research.test.mjs
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");

const { gatherCityResearch, composeNotes, extractSections, mergeResearchNotes, MERGED_LOCAL_FACTS_CAP } =
  await import("../lib/city-launch/research.ts");

const CITY = { name: "Walnut", state: "CA", stateName: "California" };

const EXTRACT = [
  "Walnut is a city in the eastern part of Los Angeles County, California, United States.",
  "The city was incorporated on January 19, 1959, and named after the Rancho Los Nogales land grant.",
  "",
  "== History ==",
  "The area was part of the Rancho San Jose and Rancho Los Nogales Mexican land grants of the 1830s.",
  "Walnut grew slowly as a rural community before suburban development arrived after World War II.",
  "",
  "== Neighborhoods ==",
  "Snow Creek is a residential neighborhood in the northern part of the city near the hills.",
  "",
  "== See also ==",
  "List of municipalities in California should never reach the notes body at all.",
].join("\n");

const WIKITEXT = "{{Infobox settlement\n| name = Walnut\n| website = https://www.cityofwalnut.org\n}}";

function jsonPage(obj) {
  return { ok: true, status: 200, body: JSON.stringify(obj), ttfbMs: 1, bytes: 1, error: "", finalUrl: "", contentType: "application/json" };
}

function stubFetcher(url) {
  if (url.includes("prop=extracts")) {
    return Promise.resolve(jsonPage({ query: { pages: [{ title: "Walnut, California", extract: EXTRACT }] } }));
  }
  if (url.includes("prop=revisions")) {
    return Promise.resolve(jsonPage({ query: { pages: [{ title: "Walnut, California", revisions: [{ content: WIKITEXT }] }] } }));
  }
  if (url.startsWith("https://www.cityofwalnut.org")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      body: "<html><head><title>City of Walnut, CA</title></head><body><p>Welcome to Walnut, a community of tree-lined streets and equestrian trails in the San Gabriel Valley.</p></body></html>",
      ttfbMs: 1,
      bytes: 1,
      error: "",
      finalUrl: url,
      contentType: "text/html",
    });
  }
  return Promise.resolve({ ok: false, status: 0, body: "", ttfbMs: 0, bytes: 0, error: "unstubbed", finalUrl: url, contentType: "" });
}

test("gather builds a sourced brief from Wikipedia + the official site", async () => {
  const brief = await gatherCityResearch(CITY, stubFetcher);
  assert.ok(brief, "brief exists");
  assert.match(brief.notes, /incorporated on January 19, 1959/);
  assert.match(brief.notes, /History: .*Rancho San Jose/);
  assert.match(brief.notes, /Neighborhoods: .*Snow Creek/);
  assert.doesNotMatch(brief.notes, /List of municipalities/);
  assert.match(brief.notes, /Sources: https:\/\/en\.wikipedia\.org\/wiki\/Walnut,_California; https:\/\/www\.cityofwalnut\.org/);
  assert.deepEqual(brief.sources, ["https://en.wikipedia.org/wiki/Walnut,_California", "https://www.cityofwalnut.org"]);
});

test("a missing Wikipedia page yields no brief (generation proceeds as before)", async () => {
  const missing = (url) =>
    url.includes("prop=extracts")
      ? Promise.resolve(jsonPage({ query: { pages: [{ title: "Nowhere, California", missing: true }] } }))
      : Promise.resolve({ ok: false, status: 0, body: "", ttfbMs: 0, bytes: 0, error: "x", finalUrl: url, contentType: "" });
  assert.equal(await gatherCityResearch({ name: "Nowhere", state: "CA", stateName: "California" }, missing), null);
});

test("extractSections splits lede and headed sections", () => {
  const sections = extractSections(EXTRACT);
  assert.equal(sections[0].title, "");
  assert.deepEqual(sections.slice(1).map((s) => s.title), ["History", "Neighborhoods", "See also"]);
});

test("merge keeps operator notes first and caps the combined block", () => {
  const brief = { city: "Walnut", state: "CA", notes: "agent ".repeat(2000), sources: [], gatheredAt: new Date().toISOString() };
  const merged = mergeResearchNotes("Operator note: the water report says X.", brief);
  assert.ok(merged.startsWith("Operator note: the water report says X."));
  assert.ok(merged.length <= MERGED_LOCAL_FACTS_CAP);
  assert.equal(mergeResearchNotes("", null), "");
  assert.equal(mergeResearchNotes(undefined, brief).startsWith("agent"), true);
});

test("composeNotes caps the body and always attributes the source", () => {
  const long = Array.from({ length: 60 }, (_, i) => `Fact number ${i} about Walnut is a reasonably long sentence for testing caps.`).join(" ");
  const notes = composeNotes(CITY, long, "https://en.wikipedia.org/wiki/Walnut,_California", null);
  assert.ok(notes.length < 5000);
  assert.match(notes, /Sources: https:\/\/en\.wikipedia\.org\/wiki\/Walnut,_California$/);
});
