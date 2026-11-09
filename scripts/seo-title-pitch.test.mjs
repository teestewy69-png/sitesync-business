// Title / pitch SEO fixes (Nov 2026 factory audit): home vs /website-design,
// 20 indexed city pages, hub/trade trims, two-audience pitch, facts + noindex policy.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { readFileSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("homepage and /website-design no longer share a title or description", async () => {
  const content = JSON.parse(src("content.json"));
  const { PAGE_DRAFTS } = await import("../lib/factory/drafts.ts");
  assert.equal(content.seo.title, "Small Business Website Design, $1,995 Flat | Sitesinc");
  assert.equal(PAGE_DRAFTS["website-design"].title, "Affordable Website Design for Small Business | Sitesinc");
  assert.notEqual(content.seo.title, PAGE_DRAFTS["website-design"].title);
  assert.notEqual(content.seo.description, PAGE_DRAFTS["website-design"].metaDescription);
  assert.ok(content.seo.title.length <= 60, content.seo.title);
  assert.ok(PAGE_DRAFTS["website-design"].title.length <= 60, PAGE_DRAFTS["website-design"].title);
  assert.match(src("components/Hero.tsx"), /Small business website design — \$1,995 flat, you own it/);
  assert.match(src("components/Hero.tsx"), /\{hero\.headline\}/);
});

test("hub titles stay under ~65 characters", async () => {
  const { PAGE_DRAFTS } = await import("../lib/factory/drafts.ts");
  assert.equal(PAGE_DRAFTS["inland-empire-small-business-website-design"].title, "Inland Empire Website Design for Small Business | $1,995");
  assert.equal(PAGE_DRAFTS["affordable-small-business-website-1995"].title, "Affordable Small Business Website, $1,995 Flat | Sitesinc");
  assert.equal(PAGE_DRAFTS["rancho-cucamonga-small-business-web-design"].title, "Rancho Cucamonga Web Design for Small Business | $1,995");
  for (const slug of [
    "inland-empire-small-business-website-design",
    "affordable-small-business-website-1995",
    "rancho-cucamonga-small-business-web-design",
  ]) {
    assert.ok(PAGE_DRAFTS[slug].title.length <= 65, `${slug} ${PAGE_DRAFTS[slug].title.length}`);
  }
});

test("indexed city pages are unique via county, hub, and 3 neighboring keep-list cities", async () => {
  const { getIndexableLocationCities, getLocationCity, isIndexableLocation } = await import("../lib/locations.ts");
  const {
    indexedLocationDescription,
    indexedLocationH1,
    nearestHubForCity,
    neighboringKeepListCities,
  } = await import("../lib/indexed-location-copy.ts");
  const anaheim = getLocationCity("anaheim-ca");
  assert.equal(indexedLocationH1(anaheim), "Website design for small businesses in Anaheim, CA");
  assert.match(indexedLocationDescription(anaheim), /Website design for Anaheim small businesses/);
  assert.match(indexedLocationDescription(anaheim), /\$997\.50 to start/);
  assert.match(indexedLocationDescription(anaheim), /Free diagnostic/);
  assert.match(indexedLocationDescription(anaheim), /\(909\) 323-1575/);
  assert.equal(anaheim.county, "Orange County");
  assert.equal(nearestHubForCity(anaheim), null);
  const neighbors = neighboringKeepListCities(anaheim);
  assert.equal(neighbors.length, 3);
  for (const n of neighbors) {
    assert.equal(isIndexableLocation(n.slug), true, n.slug);
    assert.notEqual(n.slug, "anaheim-ca");
  }

  const rancho = getLocationCity("rancho-cucamonga-ca");
  assert.equal(nearestHubForCity(rancho)?.href, "/rancho-cucamonga-small-business-web-design");
  const chino = getLocationCity("chino-ca");
  assert.equal(nearestHubForCity(chino)?.href, "/rancho-cucamonga-small-business-web-design");
  const riverside = getLocationCity("riverside-ca");
  assert.equal(nearestHubForCity(riverside)?.href, "/inland-empire-small-business-website-design");
  const pomona = getLocationCity("pomona-ca");
  assert.equal(nearestHubForCity(pomona)?.href, "/inland-empire-small-business-website-design");

  const cityPage = src("app/locations/[slug]/page.tsx");
  assert.match(cityPage, /isIndexableLocation\(city\.slug\)/);
  assert.match(cityPage, /neighboringKeepListCities/);
  assert.match(cityPage, /nearestHubForCity/);
  assert.match(cityPage, /<TwoAudiencePitch/);
  assert.equal(getIndexableLocationCities().length, 20);

  const melbourne = getLocationCity("melbourne-fl");
  assert.equal(isIndexableLocation(melbourne.slug), false);
});

test("two-audience pitch is on home, packages, 20 indexed cities, and 3 hubs", () => {
  const home = src("app/page.tsx");
  const city = src("app/locations/[slug]/page.tsx");
  const publish = src("lib/factory/publish.tsx");
  const pitch = src("components/TwoAudiencePitch.tsx");
  const copy = src("lib/two-audience-pitch.ts");
  assert.match(home, /<TwoAudiencePitch/);
  assert.match(city, /<TwoAudiencePitch/);
  assert.match(publish, /showsTwoAudiencePitch/);
  assert.match(copy, /packages/);
  assert.match(copy, /inland-empire-small-business-website-design/);
  assert.match(copy, /affordable-small-business-website-1995/);
  assert.match(copy, /rancho-cucamonga-small-business-web-design/);
  assert.match(pitch, /PITCH_NEW_BUSINESS/);
  assert.match(pitch, /PITCH_EXISTING/);
  assert.match(pitch, /PITCH_CTA/);
  assert.match(copy, /\$10,000–\$15,000/);
  assert.match(copy, /free diagnostic first/);
  assert.match(copy, /you'll be glad you made the call/);
  assert.doesNotMatch(src("app/website-design/page.tsx"), /TwoAudiencePitch/);
});

test("facts, 20-city noindex policy, and no new timeline promise stay intact", async () => {
  const content = JSON.parse(src("content.json"));
  assert.equal(content.footer.phone, "(909) 323-1575");
  assert.equal(content.footer.address.street, "1968 South Coast Hwy #3632");
  assert.equal(content.footer.address.city, "Laguna Beach");
  assert.equal(content.footer.address.postalCode, "92651");
  assert.match(content.hero.stackLine, /Timeline confirmed in writing before work starts/);
  const scan = [
    "content.json",
    "app/page.tsx",
    "app/locations/[slug]/page.tsx",
    "lib/factory/drafts.ts",
    "lib/factory/seo-hub-drafts.ts",
    "lib/two-audience-pitch.ts",
    "components/TwoAudiencePitch.tsx",
    "components/Hero.tsx",
    "app/free-website-audit/page.tsx",
    "data/trades.ts",
  ].map(src).join("\n");
  assert.doesNotMatch(scan, /232-3536|378-6404|721-5236/);
  assert.doesNotMatch(scan, /\b2-day\b|\b2 days\b|5-7 business day/i);
  assert.match(src("lib/factory/seo-hub-drafts.ts"), /Timeline is confirmed in writing before work starts/);

  process.env.SITESINC_STORE = "local";
  const { INDEXABLE_LOCATION_SLUGS } = await import("../lib/locations.ts");
  const { default: sitemap } = await import("../app/sitemap.ts");
  assert.equal(INDEXABLE_LOCATION_SLUGS.length, 20);
  const urls = (await sitemap()).map((e) => e.url);
  assert.equal(urls.filter((u) => u.startsWith("https://sitesinc.co/locations/")).length, 20);
  assert.ok(!urls.includes("https://sitesinc.co/locations/melbourne-fl"));
});

test("free diagnostic meta is trimmed; trade and compare titles stay under 60", async () => {
  const audit = src("app/free-website-audit/page.tsx");
  assert.match(audit, /Free website diagnostic for your small business/);
  const description = "Free website diagnostic for small businesses: 7 plain checks — HTTPS, mobile, speed, title, description, contact info, Google profile. No email needed.";
  assert.ok(description.length <= 160, String(description.length));
  assert.match(audit, /Free website diagnostic for small businesses/);

  const { TRADES } = await import("../data/trades.ts");
  for (const trade of TRADES) {
    assert.ok(trade.metaTitle.length <= 60, `${trade.slug} title ${trade.metaTitle.length}: ${trade.metaTitle}`);
    assert.ok(trade.metaDescription.length <= 160, `${trade.slug} meta ${trade.metaDescription.length}`);
    assert.match(trade.metaTitle, /Websites in SoCal \| \$1,995 Flat \| Sitesinc/);
  }
  const tradesHub = src("app/trades/page.tsx");
  assert.match(tradesHub, /Trade Websites in SoCal \| \$1,995 Flat \| Sitesinc/);

  const { COMPARE } = await import("../lib/compare.ts");
  for (const entry of COMPARE) {
    assert.ok(entry.title.length <= 60, `${entry.slug} ${entry.title.length}: ${entry.title}`);
  }
});
