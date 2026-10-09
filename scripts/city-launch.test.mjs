// City Launch: dataset pickers, CSV paste, ScaleQuan prompt port, uniqueness/quality gate, job helpers, provider status.
// No network, no keys, no store.
//   node --test scripts/city-launch.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { readFileSync } = await import("node:fs");
const { US_CITY_ROWS: US_CITIES, US_CITIES_META, US_STATE_ROWS } = await import("../lib/city-launch/us-cities.generated.ts");
const cities = await import("../lib/city-launch/cities.ts");
const sim = await import("../lib/city-launch/similarity.ts");
const prompts = await import("../lib/city-launch/prompts.ts");
const job = await import("../lib/city-launch/job.ts");
const llm = await import("../lib/city-launch/llm.ts");
const { evaluateGate, unsupportedClaims } = await import("../lib/city-launch/gate.ts");
const honesty = await import("../lib/city-launch/honesty.ts");

const index = cities.createCityIndex(US_CITIES, US_STATE_ROWS);

test("dataset: real unique Census places, no padded zones", () => {
  assert.equal(US_CITIES_META.count, US_CITIES.length);
  assert.ok(US_CITIES.length > 9000, `expected >9000 places, got ${US_CITIES.length}`);
  assert.equal(index.bySlug.size, index.all.length, "slugs are unique");
  assert.ok(!index.all.some((c) => /\bzone\s*\d+/i.test(c.name)), "no synthetic 'Zone N' rows");
  assert.equal(index.states.size, 51);
  for (const c of index.all) {
    assert.ok(c.population >= 1000, c.slug);
    assert.ok(c.lat > 17 && c.lat < 72 && c.lng < -64 && c.lng > -180, `${c.slug} coords`);
  }
  const phx = cities.findCity(index, "Phoenix", "AZ");
  assert.ok(phx);
  assert.equal(phx.county, "Maricopa County");
  assert.ok(phx.population > 1_500_000);
  assert.ok(Math.abs(phx.lat - 33.57) < 0.2 && Math.abs(phx.lng + 112.09) < 0.2);
  assert.ok(cities.findCity(index, "nashville", "Tennessee"), "consolidated-city override + state name");
  assert.ok(cities.findCity(index, "Honolulu", "HI"), "Urban Honolulu CDP mapped");
  assert.ok(cities.findCity(index, "St. Louis", "MO") || cities.findCity(index, "Saint Louis", "MO"));
});

test("pickers: top N in states, within X miles, nearest", () => {
  const top = cities.topCitiesInStates(index, ["az", "Nevada"], 10);
  assert.equal(top.length, 10);
  assert.equal(top[0].slug, "phoenix-az");
  assert.ok(top.some((c) => c.slug === "las-vegas-nv"));
  for (let i = 1; i < top.length; i += 1) assert.ok(top[i - 1].population >= top[i].population);
  assert.equal(cities.topCitiesInStates(index, ["TX"], 9999).length, 500, "capped at 500");

  const phx = cities.findCity(index, "Phoenix", "AZ");
  const near = cities.citiesWithinMiles(index, phx, 25, 50, { originSlug: phx.slug, order: "distance" });
  assert.ok(near.length >= 10);
  assert.ok(!near.some((c) => c.slug === phx.slug));
  assert.ok(near.every((c) => c.distanceMiles <= 25));
  const slugs = near.map((c) => c.slug);
  for (const s of ["glendale-az", "scottsdale-az", "tempe-az"]) assert.ok(slugs.includes(s), s);
  assert.ok(!slugs.includes("tucson-az"));
  const k = cities.nearestCities(phx, index.byState.get("AZ"), 3);
  assert.equal(k.length, 3);
  assert.ok(k[0].distanceMiles <= k[1].distanceMiles && /^(north|south|east|west|northeast|northwest|southeast|southwest)$/.test(k[0].direction));
});

test("CSV paste: ScaleQuan template, bare lines, unknown cities flagged not invented", () => {
  const sample = readFileSync(new URL("./fixtures/scalequan_locations_template.csv", import.meta.url), "utf8");
  const r = cities.parseCityPaste(index, sample);
  assert.deepEqual(r.cities.map((c) => c.slug), ["austin-tx", "dallas-tx"]);
  assert.ok(r.cities.every((c) => c.source === "dataset"), JSON.stringify(r.issues));
  assert.ok(r.cities.some((c) => c.keyword));

  const bare = cities.parseCityPaste(index, "Mesa, AZ\nChandler AZ\nmesa,az\nNowhereville, AZ\nFoo, ZZ\n");
  assert.deepEqual(bare.cities.map((c) => c.slug), ["mesa-az", "chandler-az", "nowhereville-az"]);
  assert.equal(bare.duplicates, 1);
  const nowhere = bare.cities[2];
  assert.equal(nowhere.source, "csv");
  assert.ok(Number.isNaN(nowhere.lat) && nowhere.population === 0, "no invented coordinates/population");
  assert.ok(bare.issues.some((i) => /unknown state/i.test(i.message)));

  const many = Array.from({ length: 700 }, (_, i) => `${index.all[i].name}, ${index.all[i].state}`).join("\n");
  const big = cities.parseCityPaste(index, many);
  assert.equal(big.cities.length, 500);
  assert.ok(big.truncated > 0);
});

// ---------------------------------------------------------------- similarity / gate

const settings = {
  keyword: "Plumbing",
  titleTemplate: prompts.DEFAULT_TITLE_TEMPLATE,
  promptTemplate: prompts.DEFAULT_PROMPT_TEMPLATE,
  competitorGaps: "",
  websiteContent: "",
  targetWordCount: 400,
  includeFaq: true,
};

function para(seed, n) {
  // deterministic pseudo-unique prose per seed
  const words = ["water", "heater", "pipe", "slab", "leak", "drain", "valve", "pressure", "hose", "gasket", "flange", "repipe",
    "copper", "pex", "sewer", "line", "root", "clay", "nipple", "union", "permit", "inspection", "remodel", "kitchen", "bath",
    "softener", "filter", "backflow", "irrigation", "elbow", "cartridge", "heat", "attic", "garage", "spigot", "homes", "coupling",
    "subdivision", "townhome", "commercial", "restaurant", "grease", "trap", "camera", "hydro", "jet", "tankless", "gas",
    "meter", "shutoff", "fixture", "toilet", "faucet", "disposal", "sump", "expansion", "tank", "thermal", "corrosion", "scale"];
  let x = seed * 2654435761 >>> 0;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    x = (x * 1103515245 + 12345) >>> 0;
    out.push(words[x % words.length]);
  }
  return out.join(" ") + ".";
}

function makeContent(cityName, seed, { cloneOf } = {}) {
  const sections = [0, 1, 2, 3].map((i) => ({ heading: `Section ${i} ${cityName}`, body: `${cityName} ${para(seed * 10 + i, 90)} ${cityName}` }));
  const c = {
    title: `Plumbing in ${cityName}, AZ`,
    metaDescription: `Plumbing help in ${cityName}, AZ near Maricopa County.`,
    h1: `Plumbing in ${cityName}`,
    heroSubhead: para(seed + 101, 12),
    intro: `${cityName} homeowners in Maricopa County, a short drive from Phoenix. ${para(seed + 202, 40)}`,
    sections,
    localHighlights: [para(seed + 303, 10)],
    faq: [{ question: `Do you serve ${cityName}?`, answer: para(seed + 404, 25) }],
    ctaHeadline: `Call for ${cityName}`,
    ctaText: para(seed + 505, 12),
  };
  if (cloneOf) {
    // find-and-replace clone: same copy, only the city name swapped
    const json = JSON.stringify(cloneOf.content).split(cloneOf.name).join(cityName);
    return JSON.parse(json);
  }
  return c;
}

function draft(slug, name, content, extra = {}) {
  return {
    slug, projectId: "p", batchId: "b",
    city: { name, state: "AZ", stateName: "Arizona", county: "Maricopa County", population: 100000, lat: 33.4, lng: -112, source: "dataset" },
    keyword: "Plumbing", content, status: "draft", words: prompts.contentWordCount(content), generatedAt: "", generations: 1,
    model: "test", providerEnvKey: "TEST",
    nearby: [{ slug: "phoenix-az", name: "Phoenix", state: "AZ", distanceMiles: 10, direction: "E" }],
    ...extra,
  };
}

test("similarity: find-and-replace clone blocks, distinct copy passes", () => {
  const mesa = makeContent("Mesa", 1);
  const tempe = makeContent("Tempe", 2);
  const cloneGilbert = makeContent("Gilbert", 3, { cloneOf: { name: "Mesa", content: mesa } });
  const res = sim.checkUniqueness([
    { slug: "mesa-az", text: prompts.contentText(mesa), maskTerms: ["Mesa", "Arizona"] },
    { slug: "tempe-az", text: prompts.contentText(tempe), maskTerms: ["Tempe", "Arizona"] },
    { slug: "gilbert-az", text: prompts.contentText(cloneGilbert), maskTerms: ["Gilbert", "Arizona"] },
  ], { globalMaskTerms: ["Mesa", "Tempe", "Gilbert", "Phoenix"] });
  const by = Object.fromEntries(res.map((r) => [r.slug, r]));
  assert.ok(by["gilbert-az"].maxScore >= 0.95, `clone score ${by["gilbert-az"].maxScore}`);
  assert.equal(by["gilbert-az"].status, "block");
  assert.equal(by["gilbert-az"].nearestSlug, "mesa-az");
  assert.equal(by["tempe-az"].status, "pass");
  assert.ok(by["tempe-az"].maxScore < sim.DEFAULT_WARN_THRESHOLD, `distinct score ${by["tempe-az"].maxScore}`);
  // masking: a template that only swaps the city is identical after masking
  const a = sim.shingleSet(sim.normalizeForSimilarity("Best plumbers in Mesa serving every Mesa street since 1999 call now", sim.buildMasker(["Mesa"])));
  const b = sim.shingleSet(sim.normalizeForSimilarity("Best plumbers in Chandler serving every Chandler street since 2004 call now", sim.buildMasker(["Chandler"])));
  assert.equal(sim.overlapScore(a, b), 1);
  assert.equal(sim.jaccardScore(a, b), 1);
});

test("gate: blocks clones, thin pages, placeholders; approved-vs-draft scoring", () => {
  const mesa = makeContent("Mesa", 1);
  const tempe = makeContent("Tempe", 2);
  const clone = makeContent("Gilbert", 3, { cloneOf: { name: "Mesa", content: mesa } });
  const thin = { ...makeContent("Peoria", 4), sections: [{ heading: "x", body: "Peoria short." }], intro: "Peoria.", faq: [], localHighlights: [] };
  const placeholder = makeContent("Glendale", 5);
  placeholder.intro += " Serving {city} fast.";
  const g = evaluateGate([
    draft("mesa-az", "Mesa", mesa),
    draft("tempe-az", "Tempe", tempe),
    draft("gilbert-az", "Gilbert", clone),
    draft("peoria-az", "Peoria", thin),
    draft("glendale-az", "Glendale", placeholder),
  ], { baseCity: "Phoenix" });
  assert.equal(g.get("tempe-az").status, "pass", g.get("tempe-az").reasons.join("; "));
  assert.equal(g.get("gilbert-az").status, "block");
  assert.match(g.get("gilbert-az").reasons[0], /Near-duplicate/);
  assert.equal(g.get("peoria-az").status, "block");
  assert.ok(g.get("peoria-az").reasons.some((r) => /Thin page/.test(r)));
  assert.equal(g.get("glendale-az").status, "block");
  // rejected drafts are excluded from comparison
  const g2 = evaluateGate([draft("mesa-az", "Mesa", mesa), draft("gilbert-az", "Gilbert", clone, { status: "rejected" })]);
  assert.equal(g2.has("gilbert-az"), false);
  assert.notEqual(g2.get("mesa-az").status, "block");
  // local-reference + honesty lint
  const oneRef = { ...makeContent("Tempe", 2), intro: `Tempe homeowners. ${para(202, 40)}` };
  const g3 = evaluateGate([draft("tempe-az", "Tempe", oneRef, { nearby: [] })], { baseCity: "Phoenix" });
  assert.equal(g3.get("tempe-az").status, "warn");
  const ours = { ...tempe, ctaText: "We love serving our city." };
  const g4 = evaluateGate([draft("tempe-az", "Tempe", ours)], { baseCity: "Phoenix" });
  assert.equal(g4.get("tempe-az").status, "block", "non-base page may not speak as a local business");
  assert.ok(g4.get("tempe-az").reasons.some((r) => /our city/.test(r)));
  assert.equal(evaluateGate([draft("phoenix-az", "Phoenix", { ...ours, intro: ours.intro.replace(/Tempe/g, "Phoenix") }, { city: { name: "Phoenix", state: "AZ", stateName: "Arizona", county: "Maricopa County", population: 1, lat: 1, lng: 1, source: "dataset" } })], { baseCity: "Phoenix" }).get("phoenix-az").reasons.some((r) => /our city/.test(r)), false, "base city may say our city");
});

test("gate: invented business claims block unless the business context supports them", () => {
  const tempe = makeContent("Tempe", 2);
  const faqClaim = { ...tempe, faq: [{ question: "Are your plumbers licensed and insured?", answer: "Yes, all our plumbers are licensed and insured." }] };
  const g = evaluateGate([draft("tempe-az", "Tempe", faqClaim)], { baseCity: "Phoenix", businessContext: "Desert Flow Plumbing - plumbing business based in Phoenix, AZ." });
  assert.equal(g.get("tempe-az").status, "block");
  assert.ok(g.get("tempe-az").reasons.some((r) => /licensed/.test(r) && /insured/.test(r)));
  const ok = evaluateGate([draft("tempe-az", "Tempe", faqClaim, { businessContext: "Licensed and insured (ROC #000000)." })], { baseCity: "Phoenix" });
  assert.notEqual(ok.get("tempe-az").status, "block");
  // advice that is not in the business's voice is fine
  assert.deepEqual(unsupportedClaims("Always hire a licensed plumber. Check the warranty on a new water heater.", ""), []);
  assert.deepEqual(unsupportedClaims("We see pipes that are 30 years old in older homes.", ""), []);
  assert.equal(unsupportedClaims("We offer free estimates and same-day service, with 20 years of experience.", "").length, 3);
  assert.equal(unsupportedClaims("Desert Flow Plumbing is top-rated.", "", "Desert Flow Plumbing").length, 1);
  assert.deepEqual(unsupportedClaims("Please inquire about any warranties or guarantees when you contact us. Ask us about licensing and insurance when you call.", ""), []);
  assert.deepEqual(unsupportedClaims("Are your plumbers licensed and insured?", ""), [], "a question asserts nothing");
});

test("honesty: non-base pages never claim a location in the city; base page may", () => {
  const chandler = { cityName: "Chandler", cityState: "AZ", stateName: "Arizona", county: "Maricopa County", baseCity: "Phoenix", baseState: "AZ", businessName: "Desert Flow Plumbing" };
  const bad = [
    "We are just 24 miles southeast of Phoenix, making it easy to reach Chandler.",
    "We are located in Chandler near Gilbert.",
    "Visit our Chandler office for a consultation.",
    "Our team is just minutes from downtown Chandler.",
    "Desert Flow Plumbing is located right in Chandler.",
    "As your local Chandler plumber, we know these streets.",
    "We are proud to serve our community.",
  ];
  for (const text of bad) {
    const issues = honesty.findHonestyIssues({ ...chandler, text });
    assert.ok(issues.some((i) => i.kind === "location_claim"), `should block: ${text}`);
  }
  const good = [
    "Desert Flow Plumbing serves Chandler from our Phoenix base. Chandler sits about 24 miles southeast of Phoenix, with Gilbert to the east and Tempe to the north.",
    "Chandler is in Maricopa County, about 4 miles south of Mesa.",
    "We serve homes across Chandler and nearby Gilbert.",
    "Contact your local water utility if you notice low pressure across the street.",
  ];
  for (const text of good) {
    assert.deepEqual(honesty.findHonestyIssues({ ...chandler, text }), [], `should pass: ${text}`);
  }
  // base city: local voice is true there
  assert.deepEqual(honesty.findHonestyIssues({ ...chandler, cityName: "Phoenix", text: "We are located in Phoenix and proud to serve our community." }), []);
  // same name, different state is NOT the base
  assert.ok(honesty.findHonestyIssues({ ...chandler, cityName: "Phoenix", cityState: "OR", stateName: "Oregon", text: "We are located in Phoenix." }).length);

  // gate wiring: the exact live-test sentence blocks the page
  const page = { ...makeContent("Chandler", 7), serviceArea: "We are just 24 miles southeast of Phoenix, so Chandler is easy for us to reach." };
  const city = { name: "Chandler", state: "AZ", stateName: "Arizona", county: "Maricopa County", population: 280167, pop2020: 275987, lat: 33.28, lng: -111.85, source: "dataset" };
  const g = evaluateGate([draft("chandler-az", "Chandler", page, { city })], { baseCity: "Phoenix", baseState: "AZ", businessName: "Desert Flow Plumbing" });
  assert.equal(g.get("chandler-az").status, "block");
  assert.ok(g.get("chandler-az").reasons.some((r) => /located in or next to this city/.test(r) && /24 miles/.test(r)));

  // repair instructions name the base and the allowed phrasing
  const fix = honesty.repairInstructions(honesty.findHonestyIssues({ ...chandler, text: bad[0] }), "Chandler", "Phoenix, AZ");
  assert.match(fix, /SERVES Chandler/);
  assert.match(fix, /Phoenix, AZ/);
  assert.match(fix, /We are just 24 miles/);
});

test("honesty: live-run regressions (no false positives on honest sentences, rankings flagged)", () => {
  const mesa = { cityName: "Mesa", cityState: "AZ", stateName: "Arizona", county: "Maricopa County", baseCity: "Phoenix", baseState: "AZ", businessName: "Desert Flow Plumbing" };
  for (const text of [
    "We serve Mesa from our Phoenix base, with nearby Gilbert just 6 miles south and Apache Junction located 10 miles east.",
    "Please call us to discuss your plumbing needs, and we will provide you with an estimate based on the specifics of your situation.",
    "We are based in Phoenix and serve Mesa every day.",
    "Desert Flow Plumbing, a Phoenix company, is based in Phoenix.",
    "Desert Flow Plumbing is just a call away.",
  ]) {
    assert.deepEqual(honesty.findHonestyIssues({ ...mesa, text }), [], `should pass: ${text}`);
  }
  for (const text of ["Desert Flow Plumbing is just 24 miles from Mesa.", "We are conveniently located in Mesa.", "Our team is based in Mesa."]) {
    assert.ok(honesty.findHonestyIssues({ ...mesa, text }).some((i) => i.kind === "location_claim"), `should block: ${text}`);
  }
  assert.equal(honesty.findHonestyIssues({ ...mesa, text: "Mesa is one of the fastest-growing cities in Arizona.", popChangePct: 2.5 })[0]?.label, "rankings / reputation");
  assert.equal(honesty.findHonestyIssues({ ...mesa, text: "The city is known for its beautiful parks." })[0]?.label, "rankings / reputation");
});

test("honesty: growth pace and state rank are checked against Census numbers", () => {
  const chandler = { cityName: "Chandler", cityState: "AZ", stateName: "Arizona", county: "Maricopa County", baseCity: "Phoenix", baseState: "AZ" };
  assert.deepEqual(honesty.findHonestyIssues({ ...chandler, popChangePct: 1.9, text: "Chandler's population continues to grow." }), []);
  assert.equal(honesty.findHonestyIssues({ ...chandler, popChangePct: 1.9, text: "Chandler's rapid growth means more homes need service." })[0]?.label, "rapid population growth", "+1.9% in four years is not rapid");
  assert.deepEqual(honesty.findHonestyIssues({ ...chandler, popChangePct: 12, text: "Chandler's rapid growth means more homes need service." }), []);
  const mesa = { ...chandler, cityName: "Mesa" };
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, stateRank: 3, text: "Mesa is the third-largest city in Arizona." }), []);
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, stateRank: 3, text: "Mesa is one of the largest cities in Arizona." }), []);
  assert.equal(honesty.findHonestyIssues({ ...mesa, stateRank: 3, text: "Mesa is the second-largest city in Arizona." })[0]?.label, "rankings / reputation");
  assert.equal(honesty.findHonestyIssues({ ...mesa, text: "Mesa is the third-largest city in Arizona." })[0]?.label, "rankings / reputation", "no rank given -> unverified");
  assert.equal(honesty.findHonestyIssues({ ...mesa, stateRank: 3, text: "Maricopa County is known for its vibrant communities." })[0]?.label, "rankings / reputation");
  const user = prompts.userPrompt(settings, { name: "Mesa", state: "AZ", stateName: "Arizona", population: 517151, stateRank: 3 }, { businessName: "X", niche: "plumbing" }, [], null);
  assert.match(user, /Population rank among Arizona places \(Census 2024\): 3rd largest/);
});

test("honesty: distances and directions must match the Census coordinates", () => {
  const at = (slug) => { const c = index.bySlug.get(slug); return { name: c.name, lat: c.lat, lng: c.lng }; };
  const glendale = { city: at("glendale-az"), places: [at("phoenix-az"), at("tolleson-az"), at("youngtown-az")] };
  const base = { cityName: "Glendale", cityState: "AZ", baseCity: "Phoenix", baseState: "AZ", businessName: "Desert Flow Plumbing" };
  // Census internal points: Glendale is ~6.3 mi WSW (245 deg) of Phoenix -> the live run's "southwest" is right
  assert.deepEqual(honesty.findHonestyIssues({ ...base, geo: glendale, text: "Desert Flow Plumbing is proud to serve Glendale, AZ, located about 6 miles southwest of Phoenix." }), []);
  const wrong = honesty.findHonestyIssues({ ...base, geo: glendale, text: "Desert Flow Plumbing is proud to serve Glendale, AZ, located about 6 miles northeast of Phoenix." });
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].kind, "geo_claim");
  assert.match(wrong[0].label, /Glendale is southwest of Phoenix, not northeast/);
  assert.deepEqual(honesty.findHonestyIssues({ ...base, geo: glendale, text: "Glendale is about 6 miles west of Phoenix, with Tolleson to the south and Youngtown to the northwest." }), []);
  const far = honesty.findHonestyIssues({ ...base, geo: glendale, text: "Glendale sits 30 miles west of Phoenix." });
  assert.match(far[0].label, /distance: Glendale is about 6 miles from Phoenix, not 30/);
  // unknown references are not guessed at
  assert.deepEqual(honesty.findHonestyIssues({ ...base, geo: glendale, text: "The shop is 2 miles north of the freeway." }), []);
  const mesa = { city: at("mesa-az"), places: [at("phoenix-az"), at("gilbert-az"), at("apache-junction-az")] };
  assert.deepEqual(honesty.findHonestyIssues({ cityName: "Mesa", baseCity: "Phoenix", geo: mesa, text: "Mesa is about 25 miles southeast of Phoenix. We serve Mesa from our Phoenix base, with nearby Gilbert just 6 miles south and Apache Junction located 10 miles east." }), []);
  assert.ok(honesty.findHonestyIssues({ cityName: "Mesa", baseCity: "Phoenix", geo: mesa, text: "Gilbert lies 6 miles north of Mesa." }).length);
});

test("honesty: climate / water / housing / growth claims need a source", () => {
  const mesa = { cityName: "Mesa", cityState: "AZ", stateName: "Arizona", county: "Maricopa County", baseCity: "Mesa", baseState: "AZ", businessName: "Desert Flow Plumbing" };
  const water = "Mesa homes deal with hard water that builds scale in water heaters.";
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, text: water }).map((i) => i.label), ["water hardness / quality"]);
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, text: water, support: "Mesa water hardness ~14 grains per gallon (City of Mesa 2025 Water Quality Report)" }), [], "verified note backs it");
  assert.equal(honesty.findHonestyIssues({ ...mesa, text: "Monsoon storms in the area can overwhelm drains." })[0].label, "climate / weather");
  assert.equal(honesty.findHonestyIssues({ ...mesa, text: "Many older homes in Mesa still have galvanized pipes." })[0].label, "housing age / stock");
  // generic advice not tied to the place is fine
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, text: "Hard water shortens the life of any water heater; a softener helps." }), []);
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, text: "We install climate control systems for Mesa homes." }), [], "climate control is a product, not a climate claim");
  // growth: backed by the Census change we pass in, in the right direction only
  const grow = "Mesa is a fast-growing city with new neighborhoods.";
  assert.ok(honesty.findHonestyIssues({ ...mesa, text: "Mesa continues to grow." }).some((i) => i.label === "population growth"));
  assert.deepEqual(honesty.findHonestyIssues({ ...mesa, text: "Mesa continues to grow.", popChangePct: 2.5 }), []);
  assert.ok(honesty.findHonestyIssues({ ...mesa, text: "Mesa continues to grow.", popChangePct: -3 }).length, "shrinking city may not be called growing");
  assert.ok(honesty.findHonestyIssues({ ...mesa, text: grow, popChangePct: 2.5 }).every((i) => i.label !== "population growth"));
});

test("prompts: voice block + local-facts-only + Census growth line", () => {
  const biz = { businessName: "Desert Flow Plumbing", niche: "plumbing", baseCity: "Phoenix", baseState: "AZ" };
  const chandler = { name: "Chandler", state: "AZ", stateName: "Arizona", county: "Maricopa County", population: 280167, pop2020: 275987 };
  const user = prompts.userPrompt(settings, chandler, biz, [], { distanceMiles: 22.6, direction: "SE" });
  assert.match(user, /VOICE: Desert Flow Plumbing is based in Phoenix, AZ\. It SERVES Chandler from Phoenix/);
  assert.match(user, /Chandler is about 23 miles SE of Phoenix/);
  assert.match(user, /Never write "we are located/);
  assert.match(user, /Population change since April 2020 .*\+1\.5%/);
  assert.match(user, /VERIFIED LOCAL NOTES[^\n]*\n\(none provided: do not state such facts\)/);
  const withNotes = prompts.userPrompt({ ...settings, localFacts: "Hardness 14 gpg (City report)" }, chandler, biz, [], null);
  assert.match(withNotes, /Hardness 14 gpg \(City report\)/);
  const home = prompts.userPrompt(settings, { ...chandler, name: "Phoenix" }, biz, [], { distanceMiles: 0, direction: "N" });
  assert.match(home, /Phoenix is Desert Flow Plumbing's home base/);
  const sys = prompts.systemPrompt(settings, chandler);
  assert.match(sys, /LOCAL FACTS ONLY/);
  assert.doesNotMatch(sys, /may appear at most once/);
});

// ---------------------------------------------------------------- prompts

test("prompts: ScaleQuan placeholders, honest system prompt, strict reply parsing", () => {
  assert.equal(prompts.fillPlaceholders("{keyword} in {city}, {state}", "Mesa", "AZ", "plumbing"), "plumbing in Mesa, AZ");
  const city = { name: "Mesa", state: "AZ", stateName: "Arizona", county: "Maricopa County", population: 518012 };
  assert.equal(prompts.pageTitleFor(settings, city), "Plumbing in Mesa, AZ");
  const sys = prompts.systemPrompt(settings, city);
  assert.match(sys, /JSON/);
  assert.match(sys, /invent|fabricat/i);
  const user = prompts.userPrompt(settings, city, { businessName: "Desert Flow Plumbing", niche: "plumbing", baseCity: "Phoenix", baseState: "AZ" },
    [{ name: "Gilbert", state: "AZ", distanceMiles: 8.1, direction: "SE" }], { distanceMiles: 17.2, direction: "E" });
  assert.match(user, /Mesa/);
  assert.match(user, /Maricopa County/);
  assert.match(user, /518,012|518012/);
  assert.match(user, /Gilbert/);

  const good = {
    metaDescription: "Licensed-style plumbing help for Mesa, AZ homes.",
    h1: "Plumbing in Mesa",
    heroSubhead: "Fast help across Mesa.",
    intro: `Mesa ${para(9, 60)}`,
    sections: [1, 2, 3].map((i) => ({ heading: `H${i}`, body: para(i + 20, 70) })),
    localHighlights: ["Near Gilbert"],
    faq: [{ question: "Do you serve Mesa?", answer: "Yes." }],
    ctaHeadline: "Call now",
    ctaText: "Book a visit.",
  };
  const parsed = prompts.parseCityPageReply("```json\n" + JSON.stringify(good) + "\n```", settings, city);
  assert.equal(parsed.title, "Plumbing in Mesa, AZ");
  assert.equal(parsed.sections.length, 3);
  assert.throws(() => prompts.parseCityPageReply(JSON.stringify({ ...good, sections: good.sections.slice(0, 1) }), settings, city), prompts.CityContentError);
  assert.throws(() => prompts.parseCityPageReply("not json at all", settings, city));
  assert.throws(() => prompts.parseCityPageReply(JSON.stringify({ ...good, intro: good.intro.replace("Mesa", "{city}") }), settings, city), /placeholder/);
  // editor round trips
  assert.deepEqual(prompts.textToSections(prompts.sectionsToText(parsed.sections)), parsed.sections);
  assert.deepEqual(prompts.textToFaq(prompts.faqToText(parsed.faq)), parsed.faq);
});

// ---------------------------------------------------------------- job helpers

test("job: runnable/retry/backoff/final status", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  const base = { slug: "a", name: "A", state: "AZ", attempts: 0 };
  assert.equal(job.isRunnable({ ...base, status: "queued" }, now, 3), true);
  assert.equal(job.isRunnable({ ...base, status: "failed", attempts: 1, nextAttemptAt: "2026-10-05T11:59:00Z" }, now, 3), true);
  assert.equal(job.isRunnable({ ...base, status: "failed", attempts: 1, nextAttemptAt: "2026-10-05T12:01:00Z" }, now, 3), false);
  assert.equal(job.isRunnable({ ...base, status: "failed", attempts: 3, nextAttemptAt: "2026-10-05T11:00:00Z" }, now, 3), false);
  assert.equal(job.isRunnable({ ...base, status: "generating", startedAt: "2026-10-05T11:59:00Z" }, now, 3), false);
  assert.equal(job.isRunnable({ ...base, status: "generating", startedAt: "2026-10-05T11:50:00Z" }, now, 3), true, "stale lease recovered");
  assert.equal(job.isRunnable({ ...base, status: "drafted" }, now, 3), false);
  const r0 = () => 0;
  assert.equal(job.retryDelayMs(1, undefined, r0), 2000);
  assert.equal(job.retryDelayMs(3, undefined, r0), 8000);
  assert.equal(job.retryDelayMs(20, undefined, r0), 60000);
  assert.equal(job.retryDelayMs(1, 15000, r0), 15000, "Retry-After honoured");
  const items = [{ ...base, status: "drafted" }, { ...base, slug: "b", status: "failed", attempts: 3 }];
  assert.equal(job.hasPendingWork(items, 3), false);
  assert.equal(job.finalStatus(items), "completed_with_errors");
  assert.equal(job.finalStatus([{ ...base, status: "drafted" }]), "completed");
  assert.equal(job.nextRetryAtMs([{ ...base, status: "failed", attempts: 1, nextAttemptAt: "2026-10-05T12:05:00Z" }], 3), Date.parse("2026-10-05T12:05:00Z"));
});

test("job: RPM limiter + bounded concurrency pool", async () => {
  let t = 0;
  const slept = [];
  const clock = { now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; } };
  const lim = job.createRateLimiter(3, clock);
  for (let i = 0; i < 3; i += 1) await lim.acquire();
  assert.equal(t, 0);
  await lim.acquire();
  assert.ok(t >= 60_000, `4th request waited for the window (t=${t})`);
  lim.pause(10_000);
  const before = t;
  await lim.acquire();
  assert.ok(t - before >= 10_000, "pause honoured");

  let inFlight = 0;
  let peak = 0;
  const queue = Array.from({ length: 20 }, (_, i) => i);
  const done = [];
  const processed = await job.runPool(() => (queue.length ? queue.shift() : null), 4, async (n) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    done.push(n);
    inFlight -= 1;
  }, () => true);
  assert.equal(processed, 20);
  assert.equal(peak, 4);
  let stopAfter = 5;
  const q2 = Array.from({ length: 20 }, (_, i) => i);
  const p2 = await job.runPool(() => (q2.length ? q2.shift() : null), 2, async () => { stopAfter -= 1; }, () => stopAfter > 0);
  assert.ok(p2 <= 6 && p2 >= 5, "stops pulling when the budget is spent");
});

test("llm provider: names only, explicit missing-key state, priority order", () => {
  const missing = llm.describeLlmProvider({});
  assert.equal(missing.configured, false);
  assert.match(missing.detail, /No LLM key configured/);
  assert.ok(missing.checked.includes("CITY_LAUNCH_LLM_API_KEY") && missing.checked.includes("OPENROUTER_API_KEY"));
  const secret = "sk-test-SECRET-should-never-appear";
  const s = llm.describeLlmProvider({ EMERGENT_LLM_KEY: secret, OPENAI_API_KEY: "" });
  assert.equal(s.configured, true);
  assert.equal(s.envKey, "EMERGENT_LLM_KEY");
  assert.ok(!JSON.stringify(s).includes(secret), "status never contains the key");
  const p = llm.describeLlmProvider({ EMERGENT_LLM_KEY: "x", OPENROUTER_API_KEY: "y", CITY_LAUNCH_LLM_API_KEY: "z", CITY_LAUNCH_LLM_MODEL: "m1" });
  assert.equal(p.envKey, "CITY_LAUNCH_LLM_API_KEY");
  assert.equal(p.model, "m1");
  assert.equal(llm.describeLlmProvider({ OPENROUTER_API_KEY: "y" }).baseUrl, "https://openrouter.ai/api/v1");
});

test("llm chatCompletion: classifies errors, retryable + Retry-After, never leaks the key", async () => {
  const resolved = llm.resolveLlmProvider({ OPENAI_API_KEY: "sk-secret-123" });
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("slow down", { status: 429, headers: { "retry-after": "7" } });
    await assert.rejects(llm.chatCompletion(resolved, [{ role: "user", content: "hi" }]), (err) => {
      assert.equal(err.kind, "rate_limit");
      assert.equal(err.retryable, true);
      assert.equal(err.retryAfterMs, 7000);
      assert.ok(!String(err.message).includes("sk-secret-123"));
      return true;
    });
    globalThis.fetch = async () => new Response("nope", { status: 401 });
    await assert.rejects(llm.chatCompletion(resolved, [{ role: "user", content: "hi" }]), (err) => err.kind === "auth" && err.retryable === false);
    let auth = "";
    globalThis.fetch = async (_url, init) => {
      auth = init.headers.Authorization || init.headers.authorization || "";
      return Response.json({ model: "gpt-4o-mini", choices: [{ message: { content: "{\"ok\":1}" } }] });
    };
    const ok = await llm.chatCompletion(resolved, [{ role: "user", content: "hi" }], { jsonMode: true });
    assert.equal(ok.content, "{\"ok\":1}");
    assert.equal(auth, "Bearer sk-secret-123");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Sitesinc City Launch picks 500 real Census cities and uses ScaleQuan only", async () => {
  const sitesinc = await import("../lib/factory/sitesinc-city.ts");
  const cityLaunch = await import("../lib/factory/city-launch.ts");
  assert.equal(sitesinc.SITESINC_CITY_PROJECT_ID, "sitesinc");
  assert.equal(sitesinc.SITESINC_CITY_LIMIT, 500);
  assert.equal(sitesinc.SITESINC_CITY_STATES.length, 51);
  const project = sitesinc.sitesincCityProjectRecord();
  const pick = cityLaunch.pickCities(project, {
    mode: "top_states",
    states: sitesinc.SITESINC_CITY_STATES,
    limit: sitesinc.SITESINC_CITY_LIMIT,
    minPopulation: 1000,
  });
  assert.equal(pick.ok, true, pick.error);
  assert.equal(pick.cities.length, 500);
  assert.ok(pick.cities.every((c) => c.population >= 1000 && c.lat && c.state));
  const slugs = new Set(pick.cities.map((c) => c.slug));
  assert.equal(slugs.size, 500);
  const locations = readFileSync(new URL("../app/locations/page.tsx", import.meta.url), "utf8");
  assert.match(locations, /SITESINC_CITY_PROJECT_ID/);
  const home = readFileSync(new URL("../app/app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /queue-sitesinc-cities/);
  assert.match(home, /CityLaunchBay/);
});
