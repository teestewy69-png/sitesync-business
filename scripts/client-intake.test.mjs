// Internal client intake + config edits + client preview honesty (isolated local store, no network).
//   node --test scripts/client-intake.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const k of ["NETLIFY", "CONTEXT", "SITE_ID", "NETLIFY_BLOBS_CONTEXT", "DEPLOY_PRIME_URL", "URL", "NEXT_PUBLIC_SITE_URL"]) delete process.env[k];
process.env.DOMAINIQ_AVAILABILITY = "off";
const work = mkdtempSync(path.join(tmpdir(), "client-intake-"));
process.chdir(work); // isolated ./data store
process.env.SITESINC_STORE = "local";

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { buildClientConfig, configFromProject, normalizeOwnedDomain } = await import("../lib/factory/client-config.ts");
const { draftFromClientBrief } = await import("../lib/factory/client-drafts.ts");
const { seedClientBriefs } = await import("../lib/factory/client-pipeline.ts");
const { buildClientPreviewModel, findForbiddenPreviewClaim } = await import("../lib/factory/client-preview.ts");
const { applyFactoryAction } = await import("../lib/factory/actions.ts");
const { readClientWorkspace, updateClientWorkspace } = await import("../lib/factory/client-workspace.ts");
const { findProjectById } = await import("../lib/store.ts");
const { generateDomainCandidatesForProject } = await import("../lib/factory/domainiq.ts");
const { buildPreviewContent } = await import("../lib/design-styles.ts");

const KURTIS = {
  businessName: "Kurtis Wells",
  contactName: "Kurtis Wells",
  email: "kurtis@example.com",
  phone: "",
  city: "Walnut",
  state: "CA",
  businessType: "Artist",
  offer: "Original artwork and paintings",
  primaryGoal: "",
  domain: "https://www.KurtisArt.example/",
  notes: "Exhibitions, galleries, representation, commissions. Originals: available on request.",
};

const allText = (value) => JSON.stringify(value);
// Thin intakes queue background DomainIQ writes; the local JSON store is not safe for concurrent writers,
// so let those fire-and-forget tasks finish before the next write.
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

test("config: template comes from business type / offer, never from the business name", () => {
  const artist = buildClientConfig(KURTIS);
  assert.equal(artist.templateId, "portfolio");
  assert.equal(artist.businessName, "Kurtis Wells");
  assert.equal(artist.contactName, "Kurtis Wells");
  assert.equal(artist.offer, "Original artwork and paintings");
  assert.equal(artist.city, "Walnut");
  assert.equal(artist.state, "CA");
  assert.equal(artist.domain, "kurtisart.example");
  assert.equal(artist.pricingNote, "Available on request");

  // An "artist"-sounding name must not pick the portfolio template for a plumber.
  const plumber = buildClientConfig({ businessName: "Artist Lane Plumbing Studio", businessType: "plumber", city: "Mesa", state: "AZ" });
  assert.notEqual(plumber.templateId, "portfolio");
  assert.equal(plumber.templateId, "local-service");

  // A bare label is never parsed for niche / template / goal.
  const labelOnly = buildClientConfig({ label: "Kurtis Wells, Artist" });
  assert.notEqual(labelOnly.templateId, "portfolio");
  assert.notEqual(labelOnly.primaryGoal, "Kurtis Wells, Artist");
});

test("config: primary goal is never the business name, contact name or label", () => {
  for (const goal of ["Kurtis Wells", "kurtis wells!", ""]) {
    const config = buildClientConfig({ ...KURTIS, primaryGoal: goal, label: "Kurtis Wells" });
    assert.notEqual(config.primaryGoal.toLowerCase().replace(/[^a-z]/g, ""), "kurtiswells", goal);
    assert.equal(config.primaryGoal, "Inquiries about the work");
  }
  // Legacy stored project with the old bug (goal == name) is corrected at read time.
  const legacy = configFromProject({
    id: "proj_legacy", source: "factory_intake", createdAt: "2026-10-07T00:00:00Z", label: "Kurtis Wells, Artist",
    businessName: "Kurtis Wells, Artist", primaryGoal: "Kurtis Wells, Artist", niche: "creative / portfolio", templateId: "portfolio",
  });
  assert.notEqual(legacy.primaryGoal, "Kurtis Wells, Artist");
  assert.equal(buildClientConfig({ ...KURTIS, primaryGoal: "Get gallery and commission inquiries" }).primaryGoal, "Get gallery and commission inquiries");
});

test("config: pricing note and domain are never invented", () => {
  const noPrice = buildClientConfig({ ...KURTIS, notes: "Paintings and drawings." });
  assert.equal(noPrice.pricingNote, "");
  assert.equal(buildClientConfig({ ...KURTIS, pricingNote: "Prints from the artist on request" }).pricingNote, "Prints from the artist on request");
  assert.equal(normalizeOwnedDomain("not a domain"), "");
  assert.equal(normalizeOwnedDomain(""), "");
});

test("drafts: real city and offer, no 'your area', no invented proof", () => {
  const config = buildClientConfig(KURTIS);
  const briefs = seedClientBriefs(config);
  assert.ok(briefs.length >= 4);
  for (const brief of briefs) {
    const draft = draftFromClientBrief(brief, config);
    assert.match(draft.body, /Walnut, CA/, brief.slug);
    assert.doesNotMatch(draft.body, /your area|service area|booked/i, brief.slug);
    assert.match(draft.body, /original artwork and paintings/i, brief.slug);
    assert.doesNotMatch(allText(brief.headings), /Who this helps|service area/i, brief.slug);
    assert.equal(findForbiddenPreviewClaim(`${draft.title}\n${draft.metaDescription}\n${draft.body}`), null, brief.slug);
  }
  const noLoc = draftFromClientBrief(briefs[0], buildClientConfig({ ...KURTIS, city: "", state: "", notes: "" }));
  assert.match(noLoc.body, /\[Location not provided yet/);
  assert.doesNotMatch(noLoc.body, /your area/);
});

test("client previews: no fake testimonials, prices, booked-jobs copy or Sitesinc branding (all templates)", () => {
  // The detector must catch the marketing showcase copy, otherwise this test proves nothing.
  assert.ok(findForbiddenPreviewClaim(allText(buildPreviewContent("Kurtis Wells", "creative / portfolio in Walnut"))));
  const configs = [
    buildClientConfig(KURTIS),
    buildClientConfig({ ...KURTIS, notes: "Paintings." }),
    buildClientConfig({ businessName: "Desert Flow Plumbing", businessType: "plumber", city: "Phoenix", state: "AZ", phone: "(602) 555-0142", email: "x@example.com" }),
    buildClientConfig({ businessName: "Corner Books", businessType: "bookstore", offer: "Used and rare books" }),
    buildClientConfig({ label: "Operator factory intake (no PII)" }),
  ];
  for (const config of configs) {
    const model = buildClientPreviewModel(config);
    assert.equal(findForbiddenPreviewClaim(allText(model)), null, `${config.businessName}: ${findForbiddenPreviewClaim(allText(model))}`);
    if (!config.pricingNote) {
      assert.equal(model.pricingNote, "", config.businessName);
      assert.doesNotMatch(allText(model.sections) + model.contactLines.join(" "), /pricing|price/i, config.businessName);
    }
  }
  const artist = buildClientPreviewModel(buildClientConfig(KURTIS));
  assert.equal(artist.templateId, "portfolio");
  assert.equal(artist.pricingNote, "Available on request");
  assert.match(artist.tagline, /Original artwork and paintings · Walnut, CA/);
  assert.deepEqual(artist.sections.map((s) => s.slug), ["about", "portfolio", "exhibitions", "contact"]);
  assert.doesNotMatch(allText(artist), /services|reviews|book/i);

  // The client preview page must not render the marketing showcase frame or its sample content.
  for (const rel of ["app/demo/client/[projectId]/page.tsx", "app/demo/client/[projectId]/[slug]/page.tsx"]) {
    const src = readFileSync(path.join(ROOT, rel), "utf8");
    assert.doesNotMatch(src, /MiniSiteFrame|buildPreviewContent|SITESINC_SITE|Live at sitesinc/, rel);
  }
});

test("record-intake: full client details map to the right fields; owned domain skips suggestions", async () => {
  const res = await applyFactoryAction("record-intake", { source: "factory_intake", ...KURTIS });
  assert.equal(res.ok, true, res.error);
  assert.ok(res.projectId);
  const project = await findProjectById(res.projectId);
  assert.equal(project.businessName, "Kurtis Wells");
  assert.equal(project.contactName, "Kurtis Wells");
  assert.equal(project.email, "kurtis@example.com");
  assert.equal(project.city, "Walnut");
  assert.equal(project.state, "CA");
  assert.equal(project.offer, "Original artwork and paintings");
  assert.equal(project.templateId, "portfolio");
  assert.equal(project.primaryGoal, "Inquiries about the work");
  assert.equal(project.pricingNote, "Available on request");
  assert.equal(project.ownedDomain, "kurtisart.example");
  assert.equal(project.selectedDomain, "kurtisart.example");
  assert.equal(project.domainStatus, "client_owned");
  assert.ok(!project.domainCandidates?.length, "no DomainIQ suggestions for a client-owned domain");
  const skip = await generateDomainCandidatesForProject(res.projectId);
  assert.equal(skip.ok, true);
  assert.match(skip.skipped || "", /already owns/);

  const ws = await readClientWorkspace(res.projectId);
  assert.equal(ws.clientContext.city, "Walnut");
  for (const page of ws.pages) {
    assert.doesNotMatch(page.body, /your area/, page.slug);
    assert.match(page.body, /Walnut, CA/, page.slug);
    assert.equal(findForbiddenPreviewClaim(page.body), null, page.slug);
  }
});

test("update-client-config: fixes a thin project and rebuilds drafts, keeping approved pages", async () => {
  const created = await applyFactoryAction("record-intake", { source: "factory_intake", label: "Kurtis Wells, Artist" });
  assert.equal(created.ok, true);
  await settle();
  const id = created.projectId;
  const before = await readClientWorkspace(id);
  assert.ok(before.pages.some((page) => /Location not provided yet/.test(page.body)), "thin project starts without a location");

  // Simulate an operator-approved page that must survive the rebuild.
  await updateClientWorkspace(id, (ws) => {
    ws.pages = ws.pages.map((page) =>
      page.slug === "contact" ? { ...page, status: "approved", approvedBy: "Tony", body: "APPROVED BODY" } : page
    );
    return ws;
  });

  const res = await applyFactoryAction("update-client-config", { projectId: id, ...KURTIS, approvedBy: "Tony" });
  await settle();
  assert.equal(res.ok, true, res.error);
  assert.ok(res.refreshed.length > 0);
  assert.ok(res.kept.includes("contact"));

  const project = await findProjectById(id);
  assert.equal(project.businessName, "Kurtis Wells");
  assert.equal(project.templateId, "portfolio");
  assert.equal(project.primaryGoal, "Inquiries about the work");
  assert.equal(project.domainStatus, "client_owned");

  const ws = await readClientWorkspace(id);
  assert.equal(ws.clientContext.businessName, "Kurtis Wells");
  assert.equal(ws.clientContext.city, "Walnut");
  assert.equal(ws.pages.find((page) => page.slug === "contact").body, "APPROVED BODY");
  for (const page of ws.pages.filter((p) => p.slug !== "contact")) {
    assert.match(page.body, /Walnut, CA/, page.slug);
    assert.doesNotMatch(page.body, /your area|Kurtis Wells, Artist/, page.slug);
  }
  assert.match(ws.stages.find((s) => s.key === "research").notes, /Location: Walnut, CA/);

  const bad = await applyFactoryAction("update-client-config", { projectId: id, domain: "not a domain" });
  assert.equal(bad.ok, false);
  const none = await applyFactoryAction("update-client-config", { projectId: id });
  assert.equal(none.ok, false);
});

test("init-client-factory on an existing workspace rebuilds drafts from the project details", async () => {
  const created = await applyFactoryAction("record-intake", { source: "factory_intake", label: "Thin artist intake" });
  const id = created.projectId;
  await settle();
  const res = await applyFactoryAction("init-client-factory", { projectId: id, city: "Walnut", state: "CA", email: "kurtis@example.com" });
  await settle();
  assert.equal(res.ok, true, res.error);
  const ws = await readClientWorkspace(id);
  assert.equal(ws.clientContext.city, "Walnut");
  for (const page of ws.pages) assert.doesNotMatch(page.body, /your area/, page.slug);
});
