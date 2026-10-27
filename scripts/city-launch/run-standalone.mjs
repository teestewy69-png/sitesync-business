// Standalone City Launch writer. Runs outside the warehouse web server.
// One process, one city at a time, Ollama (or whichever CITY_LAUNCH_* env is set).
// Drafts stay in data/factory/clients/<project>/city-launch so the warehouse can still review them.
// Does not approve pages and does not deploy.
//
//   node --env-file=.env.local scripts/city-launch/run-standalone.mjs [projectId] [batchId]
import { register } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

register("../fixtures/ts-resolver.mjs", import.meta.url);

if (process.env.NETLIFY || process.env.CONTEXT) {
  console.error("This runner is local only.");
  process.exit(1);
}
delete process.env.NETLIFY;
delete process.env.CONTEXT;
delete process.env.SITE_ID;
delete process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
process.env.SITESINC_STORE = "local";
process.env.CITY_LAUNCH_BACKGROUND = "off";

const DEFAULT_PROJECT = "proj_mvdv2seyibn960";
const projectId = process.argv[2] || DEFAULT_PROJECT;

function batchPath(id) {
  return path.join("data", "factory", "clients", projectId, "city-launch", "batches", `${id}.json`);
}
function indexPath() {
  return path.join("data", "factory", "clients", projectId, "city-launch", "index.json");
}
function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

let batchId = process.argv[3] || "";
if (!batchId) {
  const index = readJson(indexPath());
  batchId = index.batches?.[0]?.id || "";
}
if (!batchId) {
  console.error("No city batch found. Pass a batch id.");
  process.exit(1);
}

const file = batchPath(batchId);
const batch = readJson(file);
const leaseUntil = batch.lease?.until ? Date.parse(batch.lease.until) : 0;
if (leaseUntil > Date.now()) {
  console.error(`Batch ${batchId} is already being written until ${batch.lease.until}. Stop that process first.`);
  process.exit(1);
}
batch.status = "running";
batch.lease = null;
batch.settings.concurrency = 1;
batch.settings.requestsPerMinute = Math.min(batch.settings.requestsPerMinute || 10, 20);
writeFileSync(file, `${JSON.stringify(batch, null, 2)}\n`);

let ollama = "not checked";
try {
  const tags = await fetch("http://127.0.0.1:11434/api/tags");
  const body = await tags.json();
  ollama = tags.ok && Array.isArray(body.models) ? body.models.map((m) => m.name).join(", ") : `http ${tags.status}`;
} catch {
  ollama = "not reachable";
}

const { cityLaunchProviderStatus, runCityLaunchTick } = await import("../../lib/factory/city-launch.ts");
const provider = cityLaunchProviderStatus();
if (!provider.configured) {
  console.error(provider.detail);
  process.exit(2);
}
let host = provider.baseUrl || "";
try {
  host = new URL(provider.baseUrl).host;
} catch {
  /* keep raw */
}
console.log(JSON.stringify({
  step: "start",
  projectId,
  batchId,
  cities: batch.items.length,
  provider: provider.envKey,
  model: provider.model,
  host,
  ollama,
}));

let lastDrafted = -1;
const timer = setInterval(() => {
  try {
    const live = readJson(file);
    const counts = { drafted: 0, failed: 0, queued: 0, generating: 0 };
    for (const item of live.items) {
      if (counts[item.status] !== undefined) counts[item.status] += 1;
    }
    if (counts.drafted !== lastDrafted) {
      lastDrafted = counts.drafted;
      const writing = live.items.find((item) => item.status === "generating");
      console.log(JSON.stringify({
        step: "progress",
        status: live.status,
        ...counts,
        writing: writing ? `${writing.name}, ${writing.state}` : "",
      }));
    }
  } catch {
    /* file mid-write */
  }
}, 15000);

const result = await runCityLaunchTick(projectId, batchId, {});
clearInterval(timer);
const done = readJson(file);
const counts = { drafted: 0, failed: 0, queued: 0, generating: 0 };
for (const item of done.items) {
  if (counts[item.status] !== undefined) counts[item.status] += 1;
}
console.log(JSON.stringify({
  step: "tick-done",
  status: done.status,
  ...counts,
  continued: result.continued,
  detail: result.detail || "",
}));
if (done.status === "paused") process.exit(2);
