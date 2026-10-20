// Flip-site (build-to-sell) mode: presets, stages, content length, monetization, records, handoff, SiteGrow export.
//   node --test scripts/flip-mode.test.mjs   (Node >= 22.6 with --experimental-strip-types)
import { register } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
register("./fixtures/ts-resolver.mjs", import.meta.url);
for (const k of ["NETLIFY", "CONTEXT", "SITE_ID", "NETLIFY_BLOBS_CONTEXT", "DEPLOY_PRIME_URL", "URL", "NEXT_PUBLIC_SITE_URL", "GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN"]) delete process.env[k];
process.env.DOMAINIQ_AVAILABILITY = "off";
process.chdir(mkdtempSync(path.join(tmpdir(), "flip-mode-")));
process.env.SITESINC_STORE = "local";

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { buildClientConfig, parseIntakeHints } = await import("../lib/factory/client-config.ts");
const { checkContentLength, lengthTarget, MAX_ARTICLE_WORDS } = await import("../lib/factory/content-length.ts");
const { FLIP_STAGE_DEFS } = await import("../lib/factory/pipeline.ts");
const M = await import("../lib/factory/flip/model.ts");
const P = await import("../lib/factory/flip/presets.ts");
const SG = await import("../lib/factory/flip/sitegrow.ts");
const { FLIPRADAR_FLIP_CONFIG } = await import("../lib/factory/flip/flipradar.ts");
const { getProgram, destinationUrl } = await import("../lib/affiliates.ts");
const { applyFactoryAction } = await import("../lib/factory/actions.ts");
const { findProjectById } = await import("../lib/store.ts");

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const fresh = () => M.newFlipState({ projectId: "proj_t1", businessName: "FlipRadar", domain: "flipradar.co", niche: "house flipping", launchDate: "2026-10-20", ga4MeasurementId: "G-X306Z6MEQH", now: "2026-10-20T00:00:00.000Z" });

test("mode field: client by default, flip sets goal Build to sell; house-flip niche detected", () => {
  assert.equal(buildClientConfig({ businessName: "Joe Plumbing" }).mode, "client");
  const c = buildClientConfig({ businessName: "FlipRadar", mode: "flip", goals: "calculators for real estate investors" });
  assert.equal(c.mode, "flip");
  assert.equal(c.primaryGoal, "Build to sell");
  assert.equal(parseIntakeHints("tools for house flipping investors").niche, "house flipping / real-estate investing");
  assert.equal(P.flipPresetFor("house flipping / real-estate investing").id, "house-flipping");
  assert.equal(P.normalizeSiteMode("FLIP"), "flip");
  assert.equal(P.normalizeSiteMode("other"), "client");
});

test("flip stage defs are in order traffic, content, monetization, data_recording, buyer_handoff", () => {
  assert.deepEqual(FLIP_STAGE_DEFS.map((s) => s.key), ["traffic", "content", "monetization", "data_recording", "buyer_handoff"]);
  assert.deepEqual(M.FLIP_STAGE_ORDER, FLIP_STAGE_DEFS.map((s) => s.key));
});

test("content length: general target window capped at 1,500 words with min/max checks", () => {
  assert.equal(MAX_ARTICLE_WORDS, 1500);
  assert.deepEqual(lengthTarget({ max: 5000 }), { min: 900, target: 1500, max: 1500 });
  assert.equal(checkContentLength(words(1200)).status, "ok");
  assert.equal(checkContentLength(words(300)).status, "too_short");
  assert.equal(checkContentLength(words(1600)).status, "too_long");
  assert.equal(checkContentLength("<p>one two</p> ## three").words, 3);
});

test("traffic stage plans city pages, calculators and guides; flags missing AI key", () => {
  const s = M.runTrafficStage(fresh(), [{ name: "Austin", state: "TX" }, { name: "Tampa", state: "FL", slug: "tampa-fl" }], { cityLaunchReady: false });
  assert.equal(s.traffic.cityPages.length, 2);
  assert.equal(s.traffic.cityPages[0].path, "/markets/austin-tx");
  assert.ok(s.traffic.toolPages.some((p) => p.slug === "70-percent-rule-calculator"));
  assert.ok(s.traffic.contentPlan.length >= 8);
  const st = s.stages.find((x) => x.key === "traffic");
  assert.equal(st.status, "partial");
  assert.match(st.needs.join(), /AI writing key/);
});

test("content stage enforces the word window per article", () => {
  let s = M.runTrafficStage(fresh(), [], { cityLaunchReady: true });
  const [a, b, c] = s.traffic.contentPlan;
  s = M.runContentStage(s, { [a.slug]: words(1000), [b.slug]: words(1700), [c.slug]: words(100) });
  const by = Object.fromEntries(s.articles.map((x) => [x.slug, x.status]));
  assert.equal(by[a.slug], "ok");
  assert.equal(by[b.slug], "too_long");
  assert.equal(by[c.slug], "too_short");
  assert.equal(s.articles.filter((x) => x.status === "needs_writing").length, s.articles.length - 3);
});

test("monetization: plan programs as click-logged /go links, never active; AdSense placeholder", () => {
  const s = M.runMonetizationStage(fresh());
  const kiavi = s.monetization.programs.find((p) => p.slug === "kiavi");
  assert.equal(kiavi.goHref, "https://flipradar.co/go/kiavi?src=flip");
  assert.match(kiavi.rel, /sponsored/);
  assert.ok(s.monetization.programs.every((p) => p.status === "apply" || p.status === "pending"));
  assert.equal(s.monetization.adSlots.publisherId, P.ADSENSE_ID_PLACEHOLDER);
  assert.equal(s.monetization.adSlots.enabled, false);
  assert.equal(P.defaultAdSlots("ca-pub-1234567890123456").enabled, false, "ads stay off until AdSense approves");
  assert.equal(P.defaultAdSlots("ca-pub-1234567890123456", true).enabled, true);
  assert.equal(P.adsTxtLine("ca-pub-2781122781186262"), "google.com, pub-2781122781186262, DIRECT, f08c47fec0942fa0");
  // /go/[slug] resolves flip partners; untracked until env template is set
  const prog = getProgram("kiavi");
  assert.ok(prog);
  assert.deepEqual(destinationUrl(prog, {}, {}), { url: "https://www.kiavi.com/", tracked: false });
  assert.equal(destinationUrl(prog, {}, { AFFILIATE_KIAVI_URL_TEMPLATE: "https://t.example/c?u={url}" }).tracked, true);
});

test("data recording: GA4/GSC fields, snapshots seeded from launch, ledger drives P&L", () => {
  let s = fresh();
  assert.equal(s.analytics.ga4MeasurementId, "G-X306Z6MEQH");
  assert.equal(s.analytics.gscProperty, "sc-domain:flipradar.co");
  assert.deepEqual(s.records.snapshots.map((x) => x.month), ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
  assert.match(s.records.changeLog[0].change, /G-X306Z6MEQH/);
  M.addLedgerEntry(s, { date: "2026-11-05", type: "revenue", source: "AdSense", amount: 12.5, proof: "payout.pdf", note: "" }, "led_1");
  M.addLedgerEntry(s, { date: "2026-11-09", type: "expense", source: "Hosting", amount: 2, proof: "", note: "" }, "led_2");
  M.recordSnapshot(s, "2026-11", { sessions: 340, gscClicks: 40 });
  const nov = s.records.snapshots.find((x) => x.month === "2026-11");
  assert.deepEqual([nov.revenue, nov.expenses, nov.profit, nov.sessions, nov.gscClicks], [12.5, 2, 10.5, 340, 40]);
  assert.throws(() => M.addLedgerEntry(s, { date: "bad", type: "revenue", source: "", amount: 1, proof: "", note: "" }, "x"));
  s = M.runDataRecordingStage(s, { gscTokenPresent: false });
  assert.match(s.stages.find((x) => x.key === "data_recording").needs.join(), /Search Console token/);
  assert.equal(M.newFlipState({ projectId: "p", businessName: "x", domain: "", niche: "", ga4MeasurementId: "bad" }).analytics.ga4MeasurementId, "");
});

test("buyer handoff package has assets, transfer checklist (domain last), SOP, escrow, data history", () => {
  let s = M.runTrafficStage(fresh(), [{ name: "Austin", state: "TX" }], { cityLaunchReady: true });
  s = M.runMonetizationStage(s);
  M.addLedgerEntry(s, { date: "2026-10-30", type: "revenue", source: "Kiavi", amount: 1000, proof: "p", note: "" }, "l1");
  const pkg = M.buildHandoffPackage(s);
  for (const k of ["assetList", "transferChecklist", "howToRunSop", "escrowSteps", "dataHistory"]) assert.ok(pkg[k], k);
  const items = pkg.transferChecklist.map((x) => x.item).join("\n");
  for (const word of ["GitHub", "Netlify", "GA4", "Search Console", "Affiliate", "Email", "Social", "Domain"]) assert.match(items, new RegExp(word));
  assert.match(pkg.transferChecklist.at(-2).item, /^Domain LAST/);
  assert.equal(pkg.dataHistory.totals.revenue, 1000);
  assert.ok(!JSON.stringify(pkg).match(/sk_live|FACTORY_ACCESS_TOKEN/));
  s = M.runHandoffStage(s);
  assert.equal(s.stages.find((x) => x.key === "buyer_handoff").ranAt !== "", true);
});

test("SiteGrow export: drafts only, JSON + CSV format, platform limits, UTM links", () => {
  const s = M.runTrafficStage(fresh(), [{ name: "Austin", state: "TX" }], { cityLaunchReady: true });
  const drafts = SG.buildSocialDrafts(s, { platforms: ["twitter", "threads"] });
  assert.ok(drafts.length > 0);
  assert.ok(drafts.every((d) => d.status === "draft"));
  assert.ok(drafts.filter((d) => d.network === "twitter").every((d) => d.text.length + d.link.length + 1 <= 280));
  assert.match(drafts[0].link, /utm_source=twitter/);
  assert.equal(drafts[1].scheduledFor, "2026-10-21T15:00:00.000Z");
  const json = SG.sitegrowJson(s, drafts);
  assert.equal(json.format, "sitegrow-drafts/v1");
  assert.equal(json.importAs, "draft");
  const csv = SG.sitegrowCsv([{ ...drafts[0], text: 'He said "hi", ok' }]);
  assert.equal(csv.split("\n")[0], "id,site,platform,scheduled_for,status,text,link");
  assert.match(csv, /"He said ""hi"", ok"/);
});

test("FlipRadar seed + flip actions end to end on the local store (no network)", async () => {
  assert.equal(FLIPRADAR_FLIP_CONFIG.domain, "flipradar.co");
  assert.equal(FLIPRADAR_FLIP_CONFIG.ga4MeasurementId, "G-X306Z6MEQH");
  const seeded = await applyFactoryAction("flip-seed-flipradar", { test: "1", launchDate: "2026-10-20" });
  assert.equal(seeded.ok, true, seeded.error);
  const id = seeded.projectId;
  const project = await findProjectById(id);
  assert.equal(project.mode, "flip");
  assert.equal(project.ownedDomain, "flipradar.co");
  assert.equal(project.primaryGoal, "Build to sell");
  assert.match(project.label, /^\[TEST\]/);
  assert.equal(seeded.flip.analytics.ga4MeasurementId, "G-X306Z6MEQH");
  assert.equal(seeded.flip.domain, "flipradar.co");
  assert.equal(seeded.flip.businessName, "FlipRadar");
  assert.equal(seeded.flip.presetId, "house-flipping");
  assert.equal(seeded.flip.adsensePublisherId, "ca-pub-2781122781186262");
  const run = await applyFactoryAction("flip-run-stage", { projectId: id, stage: "all", cityLimit: "10" });
  assert.equal(run.ok, true, run.error);
  assert.equal(run.flip.traffic.cityPages.length, 10);
  assert.equal(run.flip.traffic.toolPages.length, 6);
  assert.equal(run.flip.monetization.programs[0].goHref.startsWith("https://flipradar.co/go/"), true);
  assert.ok(run.flip.stages.every((s) => s.ranAt), "every stage ran");
  assert.ok(run.flip.socialDrafts.length > 0);
  assert.equal((await applyFactoryAction("flip-add-ledger", { projectId: id, date: "2026-10-25", type: "revenue", source: "AdSense", amount: "3.25" })).ok, true);
  assert.equal((await applyFactoryAction("flip-run-stage", { projectId: id, stage: "bogus" })).ok, false);
  const closed = await applyFactoryAction("flip-close", { projectId: id });
  assert.equal(closed.flip.closed, true);
  assert.equal((await findProjectById(id)).stage, "closed");
});

const llm = await import("../lib/city-launch/llm.ts");
const W = await import("../lib/factory/flip/writer.ts");

test("LLM client: local Ollama base URL + model first, hosted keys stay fallback, think blocks stripped", () => {
  const local = llm.resolveLlmProvider({ LLM_BASE_URL: "http://127.0.0.1:11434/v1/", LLM_MODEL: "qwen3.8:latest", OPENROUTER_API_KEY: "x" });
  assert.equal(local.provider.id, "local");
  assert.equal(local.provider.baseUrl, "http://127.0.0.1:11434/v1");
  assert.equal(local.provider.model, "qwen3.8:latest");
  assert.equal(llm.resolveLlmProvider({ LLM_BASE_URL: "http://127.0.0.1:11434/v1", OPENROUTER_API_KEY: "x" }).provider.id, "openrouter");
  assert.equal(llm.resolveLlmProvider({ OPENROUTER_API_KEY: "x" }).provider.id, "openrouter");
  assert.equal(llm.stripThinking("<think>plan</think>\n# Hi"), "# Hi");
});

function fakeFetch(replies) {
  let i = 0; const calls = [];
  const f = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const content = replies[Math.min(i++, replies.length - 1)];
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ model: "qwen3.8:latest", choices: [{ message: { content } }] }) };
  };
  f.calls = calls; return f;
}

test("flip writer: factory LLM writes the page, repairs length + leaks, result is a draft pending approval", async () => {
  const s = M.runTrafficStage(fresh(), [], { cityLaunchReady: true });
  const env = { LLM_BASE_URL: "http://127.0.0.1:11434/v1", LLM_MODEL: "qwen3.8:latest" };
  const f = fakeFetch([`<think>x</think># Short\n${words(200)} NBA props`, `# ARV\n${words(1100)}`]);
  const g = await W.generateFlipPage(s, s.traffic.toolPages[0], { env, fetchImpl: f });
  assert.equal(f.calls[0].url, "http://127.0.0.1:11434/v1/chat/completions");
  assert.equal(f.calls[0].body.model, "qwen3.8:latest");
  assert.match(f.calls[1].body.messages.at(-1).content, /expand it/);
  assert.match(f.calls[1].body.messages.at(-1).content, /NBA/);
  assert.equal(g.attempts, 2);
  assert.equal(g.status, "pending_approval");
  assert.ok(g.words >= 900 && g.words <= 1500);
  assert.deepEqual(W.contentLeaks("Built by Sitesinc for PropCheck"), ["PropCheck", "Sitesinc"]);
  const bad = W.revalidateGenerated(s, { ...g, body: `${words(1000)} prop bets`, status: "pending_approval" });
  assert.equal(bad.status, "needs_fix");
  assert.match(W.cityDraftToMarkdown({ title: "T", h1: "Austin flips", heroSubhead: "s", intro: "i", sections: [{ heading: "H", body: "b" }], localHighlights: [], faq: [{ question: "Q?", answer: "A" }], ctaHeadline: "C", ctaText: "t" }), /## H[\s\S]*### Q\?/);
});

test("flip import + approval actions revalidate drafts; content stage uses generated guides", async () => {
  const seeded = await applyFactoryAction("flip-seed-flipradar", {});
  const id = seeded.projectId;
  await applyFactoryAction("flip-run-stage", { projectId: id, stage: "traffic", cityLimit: "3" });
  const st = (await applyFactoryAction("flip-run-stage", { projectId: id, stage: "monetization" })).flip;
  const guide = st.traffic.contentPlan[0];
  const pages = [
    { slug: guide.slug, path: guide.path, kind: "guide", title: guide.title, body: words(1000), status: "pending_approval", leaks: [], model: "qwen3.8:latest" },
    { slug: "x", path: "/x", kind: "guide", title: "x", body: words(50), status: "pending_approval", leaks: [], model: "m" },
  ];
  const imp = await applyFactoryAction("flip-import-generated", { projectId: id, pages: JSON.stringify(pages) });
  assert.equal(imp.ok, true, imp.error);
  assert.deepEqual(imp.flip.generated.map((g) => g.status), ["pending_approval", "needs_fix"]);
  const content = await applyFactoryAction("flip-run-stage", { projectId: id, stage: "content" });
  assert.equal(content.flip.articles.find((a) => a.slug === guide.slug).status, "ok");
  assert.equal((await applyFactoryAction("flip-approve-page", { projectId: id, slug: "x", kind: "guide" })).ok, false);
  const ok = await applyFactoryAction("flip-approve-page", { projectId: id, slug: guide.slug, kind: "guide" });
  assert.ok(ok.flip.generated[0].approvedAt);
  const aff = await applyFactoryAction("flip-set-affiliate", { projectId: id, slug: "kiavi", status: "pending", trackingTemplate: "https://t.example/c?u={url}" });
  assert.equal(aff.flip.monetization.programs.find((p) => p.slug === "kiavi").status, "pending");
  assert.equal((await applyFactoryAction("flip-set-affiliate", { projectId: id, slug: "kiavi", trackingTemplate: "http://x" })).ok, false);
  const an = await applyFactoryAction("flip-set-analytics", { projectId: id, adsenseApproved: "false" });
  assert.equal(an.flip.monetization.adSlots.enabled, false);
  assert.equal((await applyFactoryAction("flip-set-analytics", { projectId: id, adsensePublisherId: "pub-1" })).ok, false);
});

test("Flip Mode screen exists, is in factory nav, and wires every control to flip actions/exports", async () => {
  const { readFileSync } = await import("node:fs");
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const ui = readFileSync(path.join(root, "components/factory/FlipConsole.tsx"), "utf8");
  for (const needle of ["flip-seed-flipradar", "flip-init", "flip-run-stage", "flip-set-analytics", "flip-set-affiliate", "flip-add-ledger", "flip-record-snapshot", "flip-approve-page", "format=handoff", "format=sitegrow-json", "format=sitegrow-csv"]) assert.ok(ui.includes(needle), needle);
  assert.match(readFileSync(path.join(root, "components/factory/Shell.tsx"), "utf8"), /\/app\/flips/);
  assert.match(readFileSync(path.join(root, "app/app/flips/page.tsx"), "utf8"), /mode === "flip"/);
});

test("location parser ignores lowercase words like 'or' as state codes", () => {
  assert.equal(parseIntakeHints("Sell on Flippa or private sale after 6 months").state, "");
  assert.equal(parseIntakeHints("in or near town, available to all").state, "");
  assert.equal(parseIntakeHints("House flippers in Portland, OR").state, "OR");
  assert.equal(parseIntakeHints("We serve TX investors").state, "TX");
});
