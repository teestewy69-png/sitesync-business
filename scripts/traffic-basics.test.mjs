// Traffic basics: free lead guide, owner first-hand intake, local listings checklist,
// "[service] in [city]" plan and the optional owner video.
//   node --test scripts/traffic-basics.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const owner = await import("../lib/factory/owner-intake.ts");
const { buildClientConfig, applyConfigToProject, configFromProject } = await import("../lib/factory/client-config.ts");
const { draftFromClientBrief } = await import("../lib/factory/client-drafts.ts");
const { localListingChecklist, listingChecklistText } = await import("../lib/factory/local-listings.ts");
const { isExcludedPath } = await import("../lib/exit-intent.ts");

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const PLUMBER = {
  businessName: "Reyes Plumbing",
  businessType: "plumber",
  offer: "Residential plumbing repair",
  city: "Riverside",
  state: "CA",
  phone: "(951) 555-0100",
  email: "owner@reyesplumbing.example",
  yearsInBusiness: "since 2009",
  commonJobs: "Water heater replacement\nDrain cleaning, Leak repair",
  serviceTowns: "Riverside, Corona\nOntario CA",
  differentiator: "I answer the phone myself and give the price before I start.",
  customerStory: "A family in Corona had no hot water the week of a holiday; we replaced the tank the same afternoon.",
  licenseInfo: "",
  ownerVideoUrl: "https://youtu.be/dQw4w9WgXcQ",
};

const brief = (slug) => ({ id: slug, slug, title: slug, headings: [], competitorUrls: [], status: "draft" });

test("owner intake: questions cover the six first-hand topics, license and video optional", () => {
  const keys = owner.OWNER_INTAKE_QUESTIONS.map((q) => q.key);
  for (const k of ["yearsInBusiness", "commonJobs", "serviceTowns", "differentiator", "customerStory", "licenseInfo", "ownerVideoUrl"]) {
    assert.ok(keys.includes(k), k);
  }
  const optional = owner.OWNER_INTAKE_QUESTIONS.filter((q) => q.optional).map((q) => q.key).sort();
  assert.deepEqual(optional, ["licenseInfo", "ownerVideoUrl"]);
});

test("owner intake: config parses answers and round-trips through the project record", () => {
  const config = buildClientConfig(PLUMBER);
  assert.deepEqual(config.owner.commonJobs, ["Water heater replacement", "Drain cleaning", "Leak repair"]);
  assert.deepEqual(config.owner.serviceTowns, ["Riverside", "Corona", "Ontario CA"]);
  assert.equal(owner.yearsPhrase(config.owner.yearsInBusiness), "since 2009");
  const project = applyConfigToProject({ id: "p1", source: "factory_intake", createdAt: "2026-11-09T00:00:00Z", label: "x" }, config);
  assert.equal(project.commonJobs, "Water heater replacement\nDrain cleaning\nLeak repair");
  assert.equal(project.licenseInfo, undefined);
  assert.deepEqual(configFromProject(project).owner, config.owner);
});

test("drafts use owner answers when present", () => {
  const config = buildClientConfig(PLUMBER);
  const about = draftFromClientBrief(brief("about"), config).body;
  assert.match(about, /Reyes Plumbing has been in business since 2009\./);
  assert.match(about, /In the owner's words: "I answer the phone myself/);
  assert.match(about, /## A recent job/);
  assert.doesNotMatch(about, /Client to add the owner's story/);
  const services = draftFromClientBrief(brief("services"), config).body;
  assert.match(services, /- Water heater replacement/);
  assert.match(services, /- Drain cleaning/);
  assert.match(services, /and nearby: Corona, Ontario CA/);
  // No license answer -> no license claim.
  assert.doesNotMatch(services, /Are you licensed/);
});

test("drafts without owner answers keep bracketed notes and invent nothing", () => {
  const config = buildClientConfig({ businessName: "Plain Co", businessType: "plumber", city: "Mesa", state: "AZ" });
  const about = draftFromClientBrief(brief("about"), config).body;
  assert.match(about, /\[Client to add the owner's story/);
  assert.doesNotMatch(about, /in business (since|for)/);
  assert.doesNotMatch(about, /A recent job/);
  const services = draftFromClientBrief(brief("services"), config).body;
  assert.match(services, /\[Client to list each service/);
});

test("license appears only when the owner gave it", () => {
  const config = buildClientConfig({ ...PLUMBER, licenseInfo: "CA C-36 #123456, insured" });
  const services = draftFromClientBrief(brief("services"), config).body;
  assert.match(services, /License \/ insurance: CA C-36 #123456, insured\./);
});

test("service + city plan: one [service] in [city] row per town, never a guessed state", () => {
  const config = buildClientConfig(PLUMBER);
  const rows = owner.serviceCityPlan({ niche: config.niche, state: config.state, facts: config.owner });
  assert.deepEqual(rows.map((r) => r.title), [
    "Water heater replacement in Riverside, CA",
    "Water heater replacement in Corona, CA",
    "Water heater replacement in Ontario, CA",
  ]);
  assert.deepEqual(rows[0].alsoCovers, ["Drain cleaning", "Leak repair"]);
  const csv = owner.serviceCityCsv(rows);
  assert.match(csv, /^city,state,keyword,notes\nRiverside,CA,Water heater replacement,Also cover: Drain cleaning; Leak repair/);
  const noState = owner.serviceCityPlan({ niche: "plumbing", state: "", facts: owner.ownerFactsFrom({ serviceTowns: "Corona" }) });
  assert.equal(noState.length, 0);
});

test("owner video: YouTube/Vimeo/mp4 embed, anything else hidden", () => {
  assert.deepEqual(owner.ownerVideoEmbed("https://youtu.be/dQw4w9WgXcQ"), { kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  assert.deepEqual(owner.ownerVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  assert.deepEqual(owner.ownerVideoEmbed("https://vimeo.com/123456789"), { kind: "iframe", src: "https://player.vimeo.com/video/123456789" });
  assert.equal(owner.ownerVideoEmbed("https://cdn.example.com/owner.mp4").kind, "file");
  assert.equal(owner.ownerVideoEmbed(""), null);
  assert.equal(owner.ownerVideoEmbed(undefined), null);
  assert.equal(owner.ownerVideoEmbed("http://youtu.be/dQw4w9WgXcQ"), null);
  assert.equal(owner.ownerVideoEmbed("javascript:alert(1)"), null);
  assert.equal(owner.ownerVideoEmbed("https://example.com/page"), null);
  const component = read("components/client-site/OwnerVideo.tsx");
  assert.match(component, /if \(!embed\) return null;/);
});

test("local listings checklist: all the honest places, NAP block, no paid-link schemes", () => {
  const config = buildClientConfig(PLUMBER);
  const list = localListingChecklist(config, { website: "https://reyesplumbing.example" });
  const names = list.items.map((i) => i.name).join(" | ");
  for (const want of ["Google Business Profile", "Bing Places", "Apple Business Connect", "Yelp", "Better Business Bureau", "Nextdoor", "Riverside Chamber of Commerce", "PHCC", "dealer or installer"]) {
    assert.ok(names.includes(want) || list.items.some((i) => i.name.includes(want) || i.action.includes(want)), want);
  }
  assert.equal(list.nap.phone, "(951) 555-0100");
  const text = listingChecklistText(list);
  assert.match(text, /Never buy links, join link networks or do link swaps/);
  assert.match(text, /doesn't guarantee a ranking/);
  for (const item of list.items) {
    assert.doesNotMatch(`${item.name} ${item.action}`, /buy links|link exchange|PBN|guest post/i);
  }
});

test("free guide: page, download, pop-up and lead capture are wired; copy is honest", () => {
  const guide = read("lib/lead-guide.ts");
  assert.match(guide, /GUIDE_TITLE = "7 things your website needs to make the phone ring"/);
  assert.match(guide, /none of it guarantees a Google ranking/);
  assert.doesNotMatch(guide, /\d+\s?%|guarantee(d)? (to )?rank|#1 on Google|first page of Google/i);
  assert.doesNotMatch(guide, /5[–-]7 (business )?day|2-day/);
  const popup = read("components/ExitIntentCapture.tsx");
  assert.match(popup, /offer: GUIDE_OFFER_ID/);
  assert.match(popup, /href=\{GUIDE_PATH\}/);
  const route = read("app/api/subscribe/route.ts");
  assert.match(route, /=== GUIDE_OFFER_ID/);
  assert.match(route, /guideEmailText\(\)/);
  assert.match(read("app/free-guide/download/route.ts"), /guidePlainText\(\)/);
  assert.equal(isExcludedPath("/free-guide"), true);
  assert.match(read("app/sitemap.ts"), /paths\.add\("\/free-guide"\)/);
});
