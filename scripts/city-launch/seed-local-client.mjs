// LOCAL ONLY: create (or reuse) a test client project + per-client workspace in the local file store,
// so City Launch can be exercised end to end without a real lead. Refuses to run on Netlify.
//   SITESINC_STORE=local node scripts/city-launch/seed-local-client.mjs "Desert Flow Plumbing" plumbing Phoenix AZ "(602) 555-0142"
// Prints the project id.
import { register } from "node:module";
register("../fixtures/ts-resolver.mjs", import.meta.url);

if (process.env.NETLIFY || process.env.CONTEXT) throw new Error("seed-local-client is local-only.");
process.env.SITESINC_STORE = process.env.SITESINC_STORE || "local";

const [name = "Desert Flow Plumbing", niche = "plumbing", city = "Phoenix", state = "AZ", phone = ""] = process.argv.slice(2);
const { appendProject, listProjects, newId } = await import("../../lib/store.ts");
const { applyConfigToProject, buildClientConfig } = await import("../../lib/factory/client-config.ts");
const { initClientWorkspace } = await import("../../lib/factory/client-workspace.ts");

const existing = (await listProjects()).find((p) => p.businessName === name && p.city === city && p.state === state);
if (existing) {
  console.log(existing.id);
  process.exit(0);
}
const config = buildClientConfig({
  name,
  niche,
  businessType: niche,
  city,
  state,
  phone,
  primaryGoal: "calls",
  label: `${name} (local City Launch test)`,
  details: `Local ${niche} company in ${city}, ${state}. Local test client created by seed-local-client.mjs.`,
});
const id = newId("proj");
const project = await appendProject(
  applyConfigToProject({ id, source: "factory_intake", createdAt: new Date().toISOString(), label: `${name} (local test)` }, config)
);
await initClientWorkspace(project.id, config, { hostOrigin: null });
console.log(project.id);
