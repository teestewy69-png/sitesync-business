// Run the factory's flip content stages on a machine that can reach a local LLM (Tony's PC + Ollama).
// Uses the factory's own code (actions + writer) against a LOCAL store, then writes the generated drafts to a JSON
// file that is imported into staging with the `flip-import-generated` action. Never publishes or deploys.
//
//   set LLM_BASE_URL=http://127.0.0.1:11434/v1
//   set LLM_MODEL=qwen3.8:latest
//   node --experimental-strip-types scripts/flip-generate-local.mjs --cities 10 --out flip-generated.json
// Resumable: re-running skips pages already generated (state in ./data under the working directory).
import { register } from "node:module";
import { writeFileSync } from "node:fs";
register("./fixtures/ts-resolver.mjs", import.meta.url);
process.env.SITESINC_STORE = "local";
for (const k of ["NETLIFY", "CONTEXT", "SITE_ID", "NETLIFY_BLOBS_CONTEXT"]) delete process.env[k];

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const cities = arg("cities", "10");
const out = arg("out", "flip-generated.json");
const kinds = arg("kinds", "calculator,guide,city");
if (!process.env.LLM_BASE_URL || !process.env.LLM_MODEL) { console.error("Set LLM_BASE_URL and LLM_MODEL."); process.exit(2); }

const { applyFactoryAction } = await import("../lib/factory/actions.ts");
const { listProjects } = await import("../lib/store.ts");
let project = (await listProjects()).find((p) => p.mode === "flip" && p.ownedDomain === "flipradar.co");
if (!project) {
  const r = await applyFactoryAction("flip-seed-flipradar", {});
  if (!r.ok) throw new Error(r.error);
  project = { id: r.projectId };
}
const id = project.id;
const t = await applyFactoryAction("flip-run-stage", { projectId: id, stage: "traffic", cityLimit: cities });
if (!t.ok) throw new Error(t.error);
console.log(`local project ${id}: ${t.flip.traffic.toolPages.length} calculators, ${t.flip.traffic.contentPlan.length} guides, ${t.flip.traffic.cityPages.length} cities`);
for (const kind of kinds.split(",")) {
  const started = Date.now();
  const r = await applyFactoryAction("flip-generate", { projectId: id, kinds: kind, limit: "500" });
  if (!r.ok) throw new Error(r.error);
  const mine = r.flip.generated.filter((g) => g.kind === kind);
  console.log(`${kind}: ${mine.length} pages in ${Math.round((Date.now() - started) / 1000)}s`);
  for (const g of mine) console.log(`  ${g.status.padEnd(16)} ${String(g.words).padStart(5)}w  try ${g.attempts}  ${g.slug}${g.leaks.length ? `  LEAKS ${g.leaks}` : ""}`);
}
const c = await applyFactoryAction("flip-run-stage", { projectId: id, stage: "content" });
const state = c.flip;
writeFileSync(out, JSON.stringify({ projectId: id, model: process.env.LLM_MODEL, generatedAt: new Date().toISOString(), pages: state.generated }, null, 2));
console.log(`wrote ${state.generated.length} drafts to ${out}`);
