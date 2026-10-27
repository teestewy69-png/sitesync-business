#!/usr/bin/env node
// Run Kurtis Wells / kurtisart.com through the per-client factory (SiteGrow + DomainIQ score)
// and skip City Launch. Dry run unless --apply. Staging by default. Production refused
// unless --allow-production. Never changes Kurtis DNS or hosting.
//
//   node scripts/run-kurtis-factory.mjs
//   node scripts/run-kurtis-factory.mjs --base https://test.sitesinc.co --token-file <file> --apply
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PRODUCTION_HOSTS = new Set(["sitesinc.co", "www.sitesinc.co"]);
const OWNED_DOMAIN = "kurtisart.com";

export const KURTIS_INTAKE = {
  source: "factory_intake",
  label: "Kurtis Wells",
  businessName: "Kurtis Wells",
  contactName: "Kurtis Wells",
  city: "Los Angeles",
  state: "CA",
  businessType: "Artist",
  offer: "Original artwork and paintings",
  primaryGoal: "Show selected work and take studio inquiries",
  domain: OWNED_DOMAIN,
  pricingNote: "Available on request",
  notes:
    "Los Angeles based. Painting 26+ years. Acrylic, house paint, oil bar, and pens. Live site kurtisart.com stays on its current host and DNS; this factory run is preview only. City Launch skipped.",
};

const HOME_COPY =
  "Kurtis Wells is a Los Angeles based artist who has been painting for more than twenty-six years. He started in oil and now works in acrylic, house paint, oil bar, and pens. Inspiration comes from everyday life, humor, politics, and whatever comes into his head.";
const ABOUT_COPY = `## Artist statement\n\n${HOME_COPY}`;
const CONTACT_COPY =
  "Inquiries for original work: use the studio contact on kurtisart.com. This Sitesinc preview is not the live Kurtis site and does not change that domain's DNS or hosting.";

export function isKurtisProject(project) {
  const domain = String(project?.ownedDomain || project?.selectedDomain || "").toLowerCase().replace(/^www\./, "");
  const name = String(project?.businessName || project?.label || "").toLowerCase();
  return domain === OWNED_DOMAIN || name.includes("kurtis wells") || name.includes("kurtisart");
}

function parseArgs(argv) {
  const args = { apply: false, allowProduction: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--allow-production") args.allowProduction = true;
    else if (a.startsWith("--")) args[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Kurtisart factory run (no City Launch). Domain ${OWNED_DOMAIN} stays on its current host.`);
  console.log(`Intake: ${KURTIS_INTAKE.businessName}, ${KURTIS_INTAKE.city} ${KURTIS_INTAKE.state}, portfolio template via Artist.`);
  if (!args.apply) {
    console.log("Dry run only. Add --base https://test.sitesinc.co --token-file <file> --apply to write to staging.");
    return;
  }

  const base = String(args.base || "").replace(/\/+$/, "");
  let host = "";
  try {
    host = new URL(base).hostname.toLowerCase();
  } catch {
    console.error("--base must be a full URL such as https://test.sitesinc.co");
    process.exit(2);
  }
  if (PRODUCTION_HOSTS.has(host) && !args.allowProduction) {
    console.error(`Refusing to write into production (${host}) without --allow-production.`);
    process.exit(2);
  }
  const tokenFile = args.tokenFile || process.env.FACTORY_TOKEN_FILE;
  if (!tokenFile || !existsSync(tokenFile)) {
    console.error("--token-file (or FACTORY_TOKEN_FILE) is required with --apply.");
    process.exit(2);
  }
  const password = readFileSync(tokenFile, "utf8").trim();
  const login = await fetch(`${base}/api/factory/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie") || ""])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!login.ok || !cookie) {
    console.error(`Login failed (HTTP ${login.status}).`);
    process.exit(1);
  }

  const act = async (payload) => {
    const res = await fetch(`${base}/api/factory/action`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ hostOrigin: base, approvedBy: "run-kurtis-factory", ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(`${payload.op}: HTTP ${res.status} ${data.error || ""}`.trim());
    return data;
  };

  const exported = await fetch(`${base}/api/factory/export`, { headers: { cookie } });
  const dump = await exported.json().catch(() => ({}));
  if (!exported.ok || !dump.ok) throw new Error(`export: HTTP ${exported.status}`);
  const existing = (dump.projects || []).find(isKurtisProject);
  let projectId = existing?.id;
  let created = false;
  if (projectId) {
    console.log(`Reusing existing project ${projectId} (${existing.businessName || existing.label}).`);
    await act({ op: "update-client-config", projectId, ...KURTIS_INTAKE });
    console.log("client details refreshed");
  } else {
    const createdRes = await act({ op: "record-intake", ...KURTIS_INTAKE });
    projectId = createdRes.projectId;
    created = true;
    console.log(`Created project ${projectId}`);
  }

  const scoreRes = await fetch(`${base}/api/factory/domainiq/score`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ domain: OWNED_DOMAIN, niche: "art" }),
  });
  const score = await scoreRes.json().catch(() => ({}));
  if (scoreRes.ok && score.ok) {
    console.log(`DomainIQ score for ${OWNED_DOMAIN}: ${score.score?.total} (${score.score?.band})`);
  } else {
    console.log(`DomainIQ score skipped (HTTP ${scoreRes.status} ${score.error || ""}`.trim() + ")");
  }

  const pages = [
    { slug: "home", title: "Kurtis Wells", body: HOME_COPY },
    { slug: "about", title: "About Kurtis Wells", body: ABOUT_COPY },
    { slug: "contact", title: "Contact the studio", body: CONTACT_COPY },
  ];
  for (const [i, page] of pages.entries()) {
    await act({
      op: "set-client-page-copy",
      projectId,
      slug: page.slug,
      title: page.title,
      body: page.body,
      deferRecapture: i < pages.length - 1 ? "1" : undefined,
    });
    console.log(`page ${page.slug} saved (draft, noindex)`);
  }

  try {
    const baseline = await act({ op: "capture-client-baseline", projectId, hostOrigin: base });
    console.log(`baseline: ${baseline.created === false ? "limited or existing" : "captured"}`);
  } catch (err) {
    console.log(`baseline skipped: ${err instanceof Error ? err.message : err}`);
  }

  const preview = `${base}/demo/client/${projectId}`;
  console.log(`Preview (noindex): ${preview}`);
  console.log(`SiteGrow: ${base}/app/clients/${projectId}`);
  console.log("City Launch: not queued.");
  console.log(`Created now: ${created}. Pages stay drafts until you approve. Kurtis DNS unchanged.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
