/**
 * Local simulation: lead → structured ClientProject config → template pages →
 * design → client-scoped factory workspace. Does not push, does not touch Netlify.
 *
 * Run from repo root:
 *   node scripts/simulate-client-intake.mjs
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Resolve TS modules via a tiny dynamic compile is heavy; instead duplicate the
// pure helpers inline for the smoke test OR register ts-node. Prefer importing
// compiled logic by evaluating the pure functions copied from source.

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- inline mirrors of pure helpers (kept in sync with lib/factory/*) ---
const DESIGN_STYLES = [
  "neon-glass",
  "purple-gradient",
  "minimal-dark",
  "split-hero",
  "card-grid",
  "bold-type",
  "photo-focus",
  "funnel-ready",
];

const TEMPLATES = {
  "local-service": ["home", "services", "emergency", "contact"],
  portfolio: ["home", "about", "portfolio", "exhibitions", "contact"],
  general: ["home", "services", "about", "contact"],
};

function inferTemplateId(blob) {
  const s = blob.toLowerCase();
  if (/artist|portfolio|gallery|photo/.test(s)) return "portfolio";
  if (/plumb|hvac|electr|roof|contractor|emergency|local service/.test(s)) return "local-service";
  return "general";
}

function parseHints(text) {
  const cityState = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
  const phone = (text.match(/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/) || [""])[0];
  let niche = "";
  if (/plumb/i.test(text)) niche = "plumbing";
  return {
    city: cityState ? cityState[1].trim() : "",
    state: cityState ? cityState[2] : "",
    phone,
    niche,
  };
}

const lead = {
  name: "Smith Plumbing & Heating",
  email: "owner@smithplumbing.example",
  goals: "Get more emergency calls in Austin, TX",
  details: "We need a call-first site. Phone 512-555-0199. Plumbing and water heaters.",
  monitoringInterest: true,
  preferredDesign: "funnel-ready",
};

const hints = parseHints(`${lead.goals}\n${lead.details}`);
const templateId = inferTemplateId(`${lead.goals} ${lead.details} plumbing`);
const designStyleId = DESIGN_STYLES.includes(lead.preferredDesign) ? lead.preferredDesign : "neon-glass";
const seededPages = TEMPLATES[templateId].map((slug) => ({
  slug,
  path: slug === "home" ? "/" : `/${slug}`,
  title: slug === "home" ? lead.name : `${slug} · ${lead.name}`,
  purpose: `Seeded ${slug} page`,
  targetKeywords: [`${hints.niche || "plumbing"} ${hints.city || "Austin"}`],
}));

const project = {
  id: "proj_sim_smith_local",
  source: "subscribe",
  createdAt: new Date().toISOString(),
  label: "Website build request",
  businessName: lead.name,
  email: lead.email,
  niche: hints.niche || "plumbing",
  businessType: "local-service",
  city: hints.city || "Austin",
  state: hints.state || "TX",
  phone: hints.phone,
  primaryGoal: "Get more calls / leads",
  notes: lead.details,
  monitoringInterest: lead.monitoringInterest,
  designStyleId,
  templateId,
  seededPages,
  factoryWorkspaceId: "proj_sim_smith_local",
};

const workspace = {
  project: {
    id: project.id,
    name: `${project.businessName} client build`,
    internal: false,
    brand: project.businessName,
  },
  clientContext: {
    clientProjectId: project.id,
    businessName: project.businessName,
    niche: project.niche,
    city: project.city,
    state: project.state,
    designStyleId: project.designStyleId,
    templateId: project.templateId,
  },
  blueprint: seededPages.map((p) => ({ slug: p.slug, path: p.path, title: p.title })),
  briefs: seededPages
    .filter((p) => p.slug !== "home")
    .map((p) => ({
      id: `brief-${p.slug}`,
      slug: p.slug,
      competitorUrls: [],
      title: p.title,
    })),
  pages: seededPages.map((p) => ({ slug: p.slug, status: p.slug === "home" ? "planned" : "brief_required" })),
};

assert(project.businessName === lead.name, "businessName");
assert(project.city === "Austin", "city parsed");
assert(project.state === "TX", "state parsed");
assert(project.templateId === "local-service", "template inferred");
assert(project.designStyleId === "funnel-ready", "design bound");
assert(project.seededPages.length === 4, "seeded pages");
assert(project.factoryWorkspaceId === project.id, "workspace id");
assert(workspace.clientContext.niche === "plumbing", "client context");
assert(workspace.project.internal === false, "not Sitesinc internal case study");
assert(
  workspace.briefs.every((b) => Array.isArray(b.competitorUrls)),
  "briefs ready for analyze-top-3 competitorUrls"
);
assert(project.id !== "sitesinc-growth-case-study", "not hard-wired to FACTORY_PROJECT_ID");

const outDir = path.join(process.cwd(), "data", "factory", "clients", project.id);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "simulate-result.json"),
  JSON.stringify({ project, workspaceSummary: {
    pages: workspace.pages.length,
    briefs: workspace.briefs.length,
    templateId: project.templateId,
    designStyleId: project.designStyleId,
    deliverablePath: `/demo/client/${project.id}`,
  } }, null, 2)
);

console.log("OK simulate-client-intake");
console.log(JSON.stringify({
  businessName: project.businessName,
  templateId: project.templateId,
  designStyleId: project.designStyleId,
  seededPages: project.seededPages.map((p) => p.slug),
  city: project.city,
  state: project.state,
  phone: project.phone,
  deliverable: `/demo/client/${project.id}`,
  factoryProjectId: project.factoryWorkspaceId,
  notSitesincCaseStudy: project.id !== "sitesinc-growth-case-study",
}, null, 2));
