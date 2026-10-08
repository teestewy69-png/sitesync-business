// LOCAL ONLY real City Launch run: seeds a plumbing client in Phoenix, AZ in an ISOLATED local store
// (data dir under <workdir>, never the repo's ./data, never Blobs), picks nearby real cities, runs the real
// queue -> tick -> LLM -> draft -> quality-gate pipeline from lib/factory/city-launch.ts, and prints titles,
// excerpts and similarity scores. Needs one LLM key in the process env (names only are printed).
//   node scripts/city-launch/live-test.mjs <workdir> [count=5] [miles=25]
import { register } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
register("../fixtures/ts-resolver.mjs", import.meta.url);

if (process.env.NETLIFY || process.env.CONTEXT) throw new Error("live-test is local-only.");
const [workdir, countArg = "5", milesArg = "25"] = process.argv.slice(2);
if (!workdir) throw new Error("usage: node scripts/city-launch/live-test.mjs <workdir> [count] [miles]");
mkdirSync(workdir, { recursive: true });
process.chdir(workdir); // lib/persistence resolves ./data from cwd -> isolated store
process.env.SITESINC_STORE = "local";
process.env.CITY_LAUNCH_TICK_BUDGET_MS = process.env.CITY_LAUNCH_TICK_BUDGET_MS || "600000";

const { appendProject, listProjects, newId } = await import("../../lib/store.ts");
const { applyConfigToProject, buildClientConfig } = await import("../../lib/factory/client-config.ts");
const { initClientWorkspace } = await import("../../lib/factory/client-workspace.ts");
const cl = await import("../../lib/factory/city-launch.ts");
const { contentText, countWords } = await import("../../lib/city-launch/prompts.ts");
const { checkUniqueness, buildMasker, normalizeForSimilarity, shingleSet, overlapScore, jaccardScore } = await import("../../lib/city-launch/similarity.ts");
const { ownMaskTerms, popChangePct } = await import("../../lib/city-launch/gate.ts");
const { findHonestyIssues } = await import("../../lib/city-launch/honesty.ts");

const provider = cl.cityLaunchProviderStatus();
if (!provider.configured) {
  console.log(`MISSING KEY: ${provider.detail}`);
  process.exit(2);
}
console.log(`provider: ${provider.label} via ${provider.envKey} (model ${provider.model})`);

const name = "Desert Flow Plumbing";
let project = (await listProjects()).find((p) => p.businessName === name);
if (!project) {
  const config = buildClientConfig({
    name, niche: "plumbing", businessType: "plumbing", city: "Phoenix", state: "AZ", phone: "(602) 555-0142",
    primaryGoal: "calls", label: `${name} (City Launch live test)`,
    details: "Local plumbing company in Phoenix, AZ (City Launch live test client).",
  });
  project = await appendProject(applyConfigToProject({ id: newId("proj"), source: "factory_intake", createdAt: new Date().toISOString(), label: `${name} (live test)` }, config));
  await initClientWorkspace(project.id, config, { hostOrigin: null });
}
console.log(`project: ${project.id} (${project.businessName}, ${project.city}, ${project.state}, design ${project.designStyleId})`);

const pick = cl.pickCities(project, { mode: "radius", miles: Number(milesArg), limit: Number(countArg), includeOrigin: false });
if (!pick.ok) throw new Error(pick.error);
console.log(`picked (${pick.detail}): ${pick.cities.map((c) => `${c.name} (${c.distanceMiles} mi, pop ${c.population})`).join("; ")}`);

const t0 = Date.now();
const q = await cl.queueCityLaunchBatch(project.id, {
  cities: pick.cities, keyword: "Plumbing", pickMode: "radius", pickDetail: pick.detail, targetWordCount: 700, concurrency: 3, requestsPerMinute: 30,
}, "live-test", { autoStart: false });
if (!q.ok) throw new Error(q.error);
const batchId = q.batch.id;
const tick = await cl.runCityLaunchTick(project.id, batchId, {});
let batch = await cl.readCityBatch(project.id, batchId);
for (let i = 0; i < 120 && !/^(completed|completed_with_errors|cancelled|paused)$/.test(batch.status); i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  batch = await cl.readCityBatch(project.id, batchId);
}
console.log(`batch ${batchId}: ${batch.status} in ${Math.round((Date.now() - t0) / 1000)}s (first tick: ${tick.status}, ${tick.drafted} drafted, ${tick.failed} failed, continued=${tick.continued})`);
for (const line of batch.log.slice(-12)) console.log(`  log: ${line}`);

await cl.runCityGate(project.id);
const index = await cl.readCityIndex(project.id);
const drafts = [];
for (const item of batch.items) {
  const d = await cl.readCityDraft(project.id, item.slug);
  if (d) drafts.push(d);
}
console.log("\nPAGES");
for (const d of drafts) {
  const g = index.pages[d.slug]?.gate;
  console.log(`- ${d.content.title} | ${countWords(contentText(d.content))} words | model ${d.model} | gate ${g?.status} max ${g?.maxScore} vs ${g?.nearestSlug}${g?.reasons?.length ? ` | ${g.reasons.join(" ")}` : ""}`);
  console.log(`  meta: ${d.content.metaDescription}`);
}

// Full pairwise matrix with the same masking the gate uses.
const global = new Set();
for (const d of drafts) { global.add(d.city.name); for (const n of d.nearby) global.add(n.name); }
global.add("Phoenix");
const gmask = buildMasker([...global]);
const sets = drafts.map((d) => { const own = buildMasker(ownMaskTerms(d)); return shingleSet(normalizeForSimilarity(contentText(d.content), (t) => gmask(own(t)))); });
console.log("\nPAIRWISE (masked 5-shingle overlap coefficient / jaccard)");
const pairs = [];
for (let i = 0; i < drafts.length; i += 1) for (let j = i + 1; j < drafts.length; j += 1) {
  const o = overlapScore(sets[i], sets[j]); const jac = jaccardScore(sets[i], sets[j]);
  pairs.push({ a: drafts[i].slug, b: drafts[j].slug, overlap: Math.round(o * 1000) / 1000, jaccard: Math.round(jac * 1000) / 1000 });
  console.log(`  ${drafts[i].slug} vs ${drafts[j].slug}: ${o.toFixed(3)} / ${jac.toFixed(3)}`);
}
const max = Math.max(...pairs.map((p) => p.overlap));
console.log(`max pairwise overlap: ${max.toFixed(3)} (block >= 0.35, warn >= 0.18)`);

// Find-and-replace control: clone page 0 into page 1's city -> must block.
if (drafts.length >= 2) {
  const a = drafts[0]; const b = drafts[1];
  const cloneText = contentText(a.content).split(a.city.name).join(b.city.name);
  const ctrl = checkUniqueness([
    { slug: a.slug, text: contentText(a.content), maskTerms: ownMaskTerms(a) },
    { slug: `${b.slug}-clone`, text: cloneText, maskTerms: ownMaskTerms(b) },
  ], { globalMaskTerms: [...global] });
  console.log(`control: find-and-replace clone of ${a.slug} renamed to ${b.city.name} scores ${ctrl[1].maxScore} -> ${ctrl[1].status}`);
}

console.log("\nVOICE / HONESTY (final drafts, same check as the gate)");
for (const d of drafts) {
  const issues = findHonestyIssues({
    text: contentText(d.content), cityName: d.city.name, cityState: d.city.state, stateName: d.city.stateName, county: d.city.county,
    baseCity: project.city, baseState: project.state, businessName: project.businessName, support: d.businessContext || "",
    popChangePct: popChangePct(d),
    stateRank: d.city.stateRank,
    geo: cl.cityHonestyGeo(d.city, (d.nearby || []).map((n) => n.slug), cl.cityLaunchContext(project).baseCity),
  });
  const loc = issues.filter((i) => i.kind === "location_claim").length;
  console.log(`- ${d.city.name}: location claims ${loc}, other honesty issues ${issues.length - loc}${issues.length ? ` (${issues.map((i) => `${i.kind}: ${i.label}`).join("; ")})` : ""}`);
  console.log(`  service area: ${d.content.serviceArea || "-"}`);
}

console.log("\nEXCERPTS");
for (const d of drafts.slice(0, 2)) {
  console.log(`## ${d.content.title}\nH1: ${d.content.h1}\nintro: ${d.content.intro.slice(0, 420)}\nsection 1 "${d.content.sections[0]?.heading}": ${d.content.sections[0]?.body.slice(0, 300)}\nservice area: ${d.content.serviceArea || "-"}\nlocal highlights: ${d.content.localHighlights.slice(0, 2).join(" | ")}\n`);
}
const reportPath = path.join(workdir, "city-launch-live-report.json");
writeFileSync(reportPath, JSON.stringify({ provider: { envKey: provider.envKey, model: provider.model }, projectId: project.id, batchId, status: batch.status, pairs, drafts, gate: Object.fromEntries(drafts.map((d) => [d.slug, index.pages[d.slug]?.gate])) }, null, 2));
console.log(`report: ${reportPath}`);
