// One-shot local run: FlipRadar client + SEO baselines + ScaleQuan 500-city queue.
// Does not approve drafts and does not deploy. Refuses to run on Netlify.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

// This runner is local-only. Drop host flags that would force the Netlify blob store.
delete process.env.NETLIFY;
delete process.env.CONTEXT;
delete process.env.SITE_ID;
delete process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
process.env.SITESINC_STORE = "local";

const HOST = "http://127.0.0.1:3000";
const LIVE = "https://flipradar.netlify.app";
// Avoid bare two-letter words. Intake hint parsing treats "or" / "in" as Oregon / Indiana.
const NOTES = [
  "Public facts from https://flipradar.netlify.app only.",
  "FlipRadar is software: an eBay UK deal scanner. It checks 90-day sold prices plus uses Claude to read listing descriptions.",
  "Price on the live page: £14.99 per month after a 7-day free trial. No credit card to start. Cancel anytime.",
  "It has no local office, shop, phone, plus no crew inside a U.S. city.",
  "Profit figures on the marketing page are estimates, not guarantees.",
].join(" ");

const { appendProject, listProjects, newId, updateProject } = await import("../lib/store.ts");
const { refreshClientWorkspace } = await import("../lib/factory/client-workspace.ts");
const { applyConfigToProject, buildClientConfig } = await import("../lib/factory/client-config.ts");
const { initClientWorkspace } = await import("../lib/factory/client-workspace.ts");
const { captureClientBaseline } = await import("../lib/factory/client-baseline.ts");
const { pickCities } = await import("../lib/factory/city-launch.ts");
const { getUsCityIndex } = await import("../lib/city-launch/index.ts");
const { DOMAINIQ_ENGINE_VERSION } = await import("../lib/domainiq/index.ts");
const { FACTORY_COOKIE, factoryToken, sessionValue } = await import("../lib/factory/auth.ts");

function summarize(result) {
  return {
    id: result.snapshot.id,
    origin: result.snapshot.origin,
    reference: result.reference,
    pagesOk: result.pagesOk,
    pagesTotal: result.pagesTotal,
    limited: result.limited,
    label: result.reference ? "before (live site)" : "client preview",
  };
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  let last = "not started";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HOST, { redirect: "manual" });
      if (res.status < 500) return;
      last = `status ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : "fetch failed";
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Factory did not answer on ${HOST}: ${last}`);
}

async function warm(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

const config = buildClientConfig({
  businessName: "FlipRadar",
  name: "FlipRadar",
  niche: "eBay reselling software",
  businessType: "software",
  templateId: "general",
  designStyleId: "neon-glass",
  domain: "flipradar.netlify.app",
  monitoringInterest: true,
  primaryGoal: "Start a 7-day free trial",
  offer: "an eBay UK deal scanner that checks sold prices and reads listings with Claude",
  pricingNote: "£14.99 per month after a 7-day free trial. No credit card to start.",
  notes: NOTES,
  label: "FlipRadar",
});

const existing = (await listProjects()).find(
  (p) => p.businessName === "FlipRadar" && p.ownedDomain === "flipradar.netlify.app"
);
let projectId = existing?.id || "";
let created = false;
if (projectId) {
  await updateProject(projectId, {
    businessName: config.businessName,
    offer: config.offer,
    pricingNote: config.pricingNote,
    niche: config.niche,
    businessType: config.businessType,
    city: "",
    state: "",
    phone: "",
    primaryGoal: config.primaryGoal,
    notes: config.notes,
    designStyleId: config.designStyleId,
    templateId: config.templateId,
    seededPages: config.seededPages,
    monitoringInterest: true,
    ownedDomain: config.domain,
    selectedDomain: config.domain,
    domainStatus: "client_owned",
  });
  await refreshClientWorkspace(projectId, { ...config, city: "", state: "" }, { hostOrigin: null });
} else {
  const id = newId("proj");
  const now = new Date().toISOString();
  const project = await appendProject({
    ...applyConfigToProject(
      { id, source: "factory_intake", createdAt: now, label: "FlipRadar" },
      config
    ),
    ownedDomain: config.domain,
    selectedDomain: config.domain,
    domainStatus: "client_owned",
    domainIQ: {
      engine: DOMAINIQ_ENGINE_VERSION,
      mode: "in-process",
      purchase: "manual",
      reason: `Client already owns ${config.domain}. Domain suggestions are not auto-generated.`,
      selectedBy: "client intake",
      selectedAt: now,
    },
  });
  await initClientWorkspace(project.id, config, { hostOrigin: null });
  projectId = project.id;
  created = true;
}

console.log(JSON.stringify({
  step: "project",
  created,
  projectId,
  templateId: config.templateId,
  designStyleId: config.designStyleId,
  domain: config.domain,
  monitoringInterest: config.monitoringInterest,
  city: config.city || "",
  state: config.state || "",
  phone: config.phone || "",
}));

await waitForServer();
const previewHome = `${HOST}/demo/client/${encodeURIComponent(projectId)}`;
const warmStatus = await warm(previewHome);
console.log(JSON.stringify({ step: "preview-warm", status: warmStatus, url: previewHome }));

const reference = await captureClientBaseline({
  projectId,
  hostOrigin: HOST,
  origin: LIVE,
  referenceLabel: "before (live site)",
});
console.log(JSON.stringify({ step: "reference-baseline", ...summarize(reference) }));

const preview = await captureClientBaseline({
  projectId,
  hostOrigin: HOST,
});
console.log(JSON.stringify({ step: "preview-baseline", ...summarize(preview) }));

const index = getUsCityIndex();
const states = [...index.states.keys()];
const picked = pickCities(
  { id: projectId, businessName: "FlipRadar", niche: config.niche, city: "", state: "", designStyleId: "neon-glass" },
  { mode: "top_states", states, limit: 500 }
);
if (!picked.ok || picked.cities.length !== 500) {
  throw new Error(`City pick failed: ${picked.error || picked.detail} (${picked.cities.length} cities)`);
}
console.log(JSON.stringify({
  step: "pick",
  count: picked.cities.length,
  detail: picked.detail,
  first: `${picked.cities[0].name}, ${picked.cities[0].state}`,
  last: `${picked.cities.at(-1).name}, ${picked.cities.at(-1).state}`,
}));

const cookie = `${FACTORY_COOKIE}=${await sessionValue(factoryToken())}`;
const batchBody = {
  op: "queue",
  projectId,
  approvedBy: "operator",
  batch: {
    cities: picked.cities.map((c) => ({ name: c.name, state: c.state })),
    keyword: "eBay flipping deals",
    titleTemplate: "{keyword} in {city}, {state}",
    pickMode: "top_states",
    pickDetail: picked.detail,
    includeFaq: true,
    localFacts: [
      "Source: https://flipradar.netlify.app (live marketing page).",
      "FlipRadar reads eBay UK listings. Do not claim a U.S. eBay feed.",
      "Prices are in GBP: £14.99 per month after a 7-day free trial. No credit card required to start.",
      "FlipRadar is software. It has no office, shop, crew, or address in this city.",
      "Do not invent a phone number, reviews, guarantees, or dollar prices.",
    ].join(" "),
    websiteContent: [
      "FlipRadar is software (a website), not a local service business.",
      "It scans eBay UK in real time, checks 90-day sold prices for market value, and uses Claude to read listing descriptions.",
      "Live price: £14.99 per month after a 7-day free trial. No credit card to start. Cancel anytime.",
      "It has no office, shop, or local crew in the city this page is about. Write for resellers who live there and can use the software.",
      "Profit figures on the marketing page are estimates, not guarantees.",
      "Source: https://flipradar.netlify.app",
    ].join(" "),
  },
};

const queueRes = await fetch(`${HOST}/api/factory/city-launch`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify(batchBody),
});
const queueJson = await queueRes.json();
const provider = queueJson.batch?.provider || null;
console.log(JSON.stringify({
  step: "queue",
  http: queueRes.status,
  ok: queueJson.ok,
  error: queueJson.error || "",
  batchId: queueJson.batch?.id || "",
  status: queueJson.batch?.status || "",
  cities: queueJson.batch?.items?.length || 0,
  provider: provider ? { envKey: provider.envKey, model: provider.model } : null,
  skipped: (queueJson.skipped || []).length,
}));

if (!queueJson.ok) process.exit(queueJson.error?.toLowerCase().includes("key") ? 2 : 1);
console.log(JSON.stringify({ step: "writing", projectId, batchId: queueJson.batch.id, app: `${HOST}/app/clients/${projectId}` }));
