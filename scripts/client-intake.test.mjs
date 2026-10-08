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
const { baselineNeedsRecapture, BASELINE_PENDING_STALE_MS, markBaselineStale } = await import("../lib/factory/client-automation.ts");
const { createServer } = await import("node:http");
const { parseDraftBlocks } = await import("../lib/factory/draft-blocks.ts");
const { plannedPagePurpose, seedPagesForTemplate, CLIENT_TEMPLATES } = await import("../lib/factory/client-templates.ts");
const { seedClientResearchNotes } = await import("../lib/factory/client-pipeline.ts");
const { clientDomainSeedFromProject } = await import("../lib/factory/domainiq.ts");
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
  await settle();
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

/** Split a draft body into { heading: text } for its "## " sections. */
function sectionsOf(body) {
  const out = {};
  for (const chunk of body.split(/^## /m).slice(1)) {
    const [heading, ...rest] = chunk.split("\n");
    out[heading.trim()] = rest.join("\n").trim();
  }
  return out;
}

test("portfolio drafts: each heading gets its own text; location never sits under 'Available originals'", () => {
  const config = buildClientConfig(KURTIS);
  const briefs = seedClientBriefs(config);
  const portfolio = draftFromClientBrief(briefs.find((b) => b.slug === "portfolio"), config);
  const sections = sectionsOf(portfolio.body);
  assert.ok(sections["Available originals"] !== undefined, "has Available originals");
  assert.doesNotMatch(sections["Available originals"], /Walnut|Based in|\bCA\b/);
  assert.match(sections["Available originals"], /originals/i);
  assert.match(sections["Available originals"], /Pricing: Available on request/);
  assert.match(sections["Selected work"], /Kurtis Wells makes original artwork and paintings in Walnut, CA\./);
  assert.match(sections["How to inquire"], /kurtis@example\.com/);

  for (const brief of briefs) {
    const draft = draftFromClientBrief(brief, config);
    for (const [heading, text] of Object.entries(sectionsOf(draft.body))) {
      assert.ok(text.length > 0, `${brief.slug}: empty section ${heading}`);
      if (/originals|upcoming|inquiries$|pricing/i.test(heading)) {
        assert.doesNotMatch(text, /^Based in /m, `${brief.slug}: location line under ${heading}`);
      }
    }
  }
  const about = sectionsOf(draftFromClientBrief(briefs.find((b) => b.slug === "about"), config).body);
  assert.match(about["Based in Walnut, CA"], /Kurtis Wells is based in Walnut, CA\./);
});

test("update-client-config: a domain saved with other fields reaches research notes + context on the FIRST save; old suggestions are cleared", async () => {
  const created = await applyFactoryAction("record-intake", { source: "factory_intake", label: "Kurtis Wells, Artist" });
  assert.equal(created.ok, true, created.error);
  const id = created.projectId;
  await settle();
  const gen = await generateDomainCandidatesForProject(id, { force: true });
  assert.equal(gen.ok, true, gen.error);
  assert.ok((await findProjectById(id)).domainCandidates.length > 0, "suggestions exist before the client domain");

  // One save: domain together with the other fields (what the operator form sends).
  const res = await applyFactoryAction("update-client-config", { projectId: id, ...KURTIS, approvedBy: "Tony" });
  assert.equal(res.ok, true, res.error);
  await settle();

  const ws = await readClientWorkspace(id);
  assert.equal(ws.clientContext.domain, "kurtisart.example");
  assert.match(ws.stages.find((s) => s.key === "research").notes, /Client-owned domain: kurtisart\.example/);
  const project = await findProjectById(id);
  assert.equal(project.ownedDomain, "kurtisart.example");
  assert.equal(project.domainStatus, "client_owned");
  assert.equal(project.domainCandidates.length, 0, "pre-ownership suggestions cleared");

  // Clearing the domain drops the ownership + selection (Generate is available again).
  const cleared = await applyFactoryAction("update-client-config", { projectId: id, domain: "" });
  assert.equal(cleared.ok, true, cleared.error);
  await settle();
  const after = await findProjectById(id);
  assert.ok(!after.ownedDomain);
  assert.ok(!after.selectedDomain);
  assert.notEqual(after.domainStatus, "client_owned");
  const wsAfter = await readClientWorkspace(id);
  assert.doesNotMatch(wsAfter.stages.find((s) => s.key === "research").notes, /Client-owned domain/);
});

test("baselineNeedsRecapture: derived from persisted status only", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const iso = (ms) => new Date(ms).toISOString();
  assert.equal(baselineNeedsRecapture(undefined, now), false);
  assert.equal(baselineNeedsRecapture({ status: "captured", stale: false, capturedAt: iso(now - 1000) }, now), false);
  assert.equal(baselineNeedsRecapture({ status: "failed", stale: false }, now), false, "failures are shown, not retried in a loop");
  assert.equal(baselineNeedsRecapture({ status: "missing", stale: false }, now), true, "page supplies the host");
  assert.equal(baselineNeedsRecapture({ status: "stale", stale: true }, now), true);
  assert.equal(baselineNeedsRecapture({ status: "pending", stale: false, lastAttemptAt: iso(now - 5000) }, now), false, "a run in progress");
  assert.equal(
    baselineNeedsRecapture({ status: "pending", stale: false, lastAttemptAt: iso(now - BASELINE_PENDING_STALE_MS - 1) }, now),
    true,
    "a pending run that never finished (frozen function) is picked up again"
  );
  assert.equal(
    baselineNeedsRecapture({ status: "captured", stale: false, capturedAt: iso(now - 9000), recaptureRequestedAt: iso(now - 5000) }, now),
    true
  );
  const stale = markBaselineStale({ status: "captured", stale: false, capturedAt: iso(now - 9000), hostOrigin: "https://x.example" }, "edit");
  assert.equal(stale.status, "stale");
  assert.ok(stale.recaptureRequestedAt);
  assert.equal(baselineNeedsRecapture(stale, now), true);
});

test("edit / design change: preview recapture runs INLINE (no timers) and recovery op picks up a lost one", async () => {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url);
    if (req.url === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("User-agent: *\nAllow: /\n");
    }
    if (req.url === "/sitemap.xml") {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><html><head><title>Kurtis Wells</title><meta name="description" content="Original artwork."></head><body><h1>Kurtis Wells</h1><p>Original artwork and paintings in Walnut, CA.</p></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const host = `http://127.0.0.1:${server.address().port}`;
  try {
    const created = await applyFactoryAction("record-intake", { source: "factory_intake", ...KURTIS });
    assert.equal(created.ok, true, created.error);
    const id = created.projectId;
    await settle();

    hits.length = 0;
    const res = await applyFactoryAction("update-client-config", { projectId: id, offer: "Original paintings", hostOrigin: host });
    assert.equal(res.ok, true, res.error);
    // No settle(): the recapture must already be done when the action returns.
    const ws = await readClientWorkspace(id);
    const baseline = ws.clientAutomation.baseline;
    assert.equal(baseline.status, "captured", baseline.reason);
    assert.equal(baseline.stale, false);
    assert.equal(baseline.hostOrigin, host);
    assert.equal(baselineNeedsRecapture(baseline), false);
    assert.ok(hits.some((url) => url.startsWith(`/demo/client/${id}`)), "crawled this client's preview");
    assert.equal(ws.latestBaselineBySite[id], baseline.baselineId);

    // Design change: same inline behaviour.
    hits.length = 0;
    const design = await applyFactoryAction("bind-client-design", { projectId: id, designStyleId: "editorial", hostOrigin: host });
    assert.equal(design.ok, true, design.error);
    const afterDesign = (await readClientWorkspace(id)).clientAutomation.baseline;
    assert.equal(afterDesign.status, "captured", afterDesign.reason);
    assert.ok(hits.length > 0, "design change recaptured inline");

    // Simulate a recapture lost to a frozen function: stale + requested, never captured.
    await updateClientWorkspace(id, (current) => {
      current.clientAutomation.baseline = markBaselineStale(current.clientAutomation.baseline, "lost");
      return current;
    });
    assert.equal(baselineNeedsRecapture((await readClientWorkspace(id)).clientAutomation.baseline), true);
    hits.length = 0;
    const recovered = await applyFactoryAction("recapture-client-baseline", { projectId: id, hostOrigin: host });
    assert.equal(recovered.ok, true, recovered.error);
    const healed = (await readClientWorkspace(id)).clientAutomation.baseline;
    assert.equal(healed.status, "captured");
    assert.equal(baselineNeedsRecapture(healed), false);
    assert.ok(hits.length > 0);

    // Not needed -> no crawl.
    hits.length = 0;
    const noop = await applyFactoryAction("recapture-client-baseline", { projectId: id, hostOrigin: host });
    assert.equal(noop.ok, true);
    assert.equal(noop.created, false);
    assert.equal(hits.length, 0);

    // A crawl of another origin (e.g. the client's live site) is a labeled reference, not the preview baseline.
    const before = (await readClientWorkspace(id)).latestBaselineBySite[id];
    const ref = await applyFactoryAction("capture-client-baseline", {
      projectId: id,
      hostOrigin: host,
      previewOrigin: `${host}/live-site`,
      referenceLabel: "before (live site)",
    });
    assert.equal(ref.ok, true, ref.error);
    const wsRef = await readClientWorkspace(id);
    assert.equal(wsRef.latestBaselineBySite[id], before, "reference crawl does not replace the preview baseline");
    assert.equal(wsRef.clientReferenceBaselines[0].label, "before (live site)");
    assert.equal(wsRef.clientReferenceBaselines[0].origin, `${host}/live-site`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("draft preview: headings render as headings, never as raw '## ' text", () => {
  const config = buildClientConfig(KURTIS);
  const brief = seedClientBriefs(config).find((b) => b.slug === "portfolio");
  const blocks = parseDraftBlocks(draftFromClientBrief(brief, config).body);
  const headings = blocks.filter((b) => b.type === "heading").map((b) => b.text);
  assert.deepEqual(headings.slice(0, 3), ["Selected work", "Available originals", "How to inquire"]);
  for (const block of blocks) {
    const lines = block.type === "paragraph" ? block.lines : block.type === "list" ? block.items : [block.text];
    for (const line of lines) assert.doesNotMatch(line, /^#/, "no raw markdown heading markers");
  }
  assert.deepEqual(parseDraftBlocks("Intro\n\n- one\n- two\nAfter"), [
    { type: "paragraph", lines: ["Intro"] },
    { type: "list", items: ["one", "two"] },
    { type: "paragraph", lines: ["After"] },
  ]);
  const src = readFileSync(path.join(ROOT, "app/demo/client/[projectId]/[slug]/page.tsx"), "utf8");
  assert.match(src, /<DraftBody body=\{body\}/);
  assert.doesNotMatch(src, /whitespace-pre-wrap[^>]*>\{body\}/);
});

test("planned-page labels are template-aware: no booking wording outside service templates", () => {
  assert.equal(plannedPagePurpose("portfolio", { slug: "contact", purpose: "Inquiries and booking." }), "Inquiries.");
  assert.doesNotMatch(plannedPagePurpose("portfolio", { slug: "extra", purpose: "Commissions and booking." }), /book/i);
  assert.doesNotMatch(plannedPagePurpose("general", { slug: "extra", purpose: "Booking and quotes." }), /book/i);
  for (const template of CLIENT_TEMPLATES.filter((t) => t.id !== "local-service")) {
    for (const page of seedPagesForTemplate(template.id, { businessName: "Kurtis Wells", niche: "art", city: "Walnut", state: "CA" })) {
      assert.doesNotMatch(plannedPagePurpose(template.id, page), /\bbook/i, `${template.id}/${page.slug}`);
    }
  }
  // Service templates keep their own wording.
  const service = CLIENT_TEMPLATES.find((t) => t.id === "local-service").pages[0];
  assert.equal(plannedPagePurpose("local-service", service), service.purpose);
  const artist = buildClientPreviewModel(buildClientConfig(KURTIS));
  assert.doesNotMatch(allText(artist), /\bbook/i);
});

test("research notes describe automatic baseline capture", () => {
  const notes = seedClientResearchNotes(buildClientConfig(KURTIS));
  assert.doesNotMatch(notes, /operator-triggered/);
  assert.match(notes, /crawled automatically/);
  assert.match(notes, /never invented/);
});

test("domain panel seed comes from the current client config, not the intake label", () => {
  const seed = clientDomainSeedFromProject({
    id: "proj_seed", source: "factory_intake", createdAt: "2026-10-07T00:00:00Z", label: "Kurtis Wells, Artist",
    businessName: "Kurtis Wells", businessType: "Artist", offer: "Original artwork and paintings", city: "Walnut", state: "CA",
  });
  assert.equal(seed.businessName, "Kurtis Wells");
  assert.equal(seed.city, "Walnut");
  assert.equal(seed.state, "CA");
  const src = readFileSync(path.join(ROOT, "components/factory/DomainIQPanel.tsx"), "utf8");
  assert.match(src, /const seed = seedPreview;/);
});
