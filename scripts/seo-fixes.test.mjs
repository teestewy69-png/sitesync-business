// SEO fixes from the Oct 27 audit: self-referencing hub canonicals, internal links,
// meta lengths, city titles, Service/Offer schema, sitemap lastmod, robots Host, address.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { readFileSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HUB_PATHS = [
  "/website-design",
  "/packages",
  "/website-redesign",
  "/seo-ready-websites",
  "/website-monitoring",
  "/for-local-service-businesses",
];

test("home and terms meta descriptions are ~150-160 characters", async () => {
  const content = JSON.parse(readFileSync(path.join(ROOT, "content.json"), "utf8"));
  const home = content.seo.description;
  assert.ok(home.length >= 145 && home.length <= 165, `home description ${home.length}: ${home}`);
  assert.match(home, /We build real, working websites, not subscriptions like the rest/);
  assert.match(home, /\$1,995/);

  const terms = readFileSync(path.join(ROOT, "app/terms/page.tsx"), "utf8");
  const match = terms.match(/description: "([^"]+)"/);
  assert.ok(match, "terms description");
  assert.ok(match[1].length >= 145 && match[1].length <= 165, `terms description ${match[1].length}: ${match[1]}`);
});

test("city page titles drop the $1,995 / Sitesinc tail and stay under 60 chars", async () => {
  const src = readFileSync(path.join(ROOT, "app/locations/[slug]/page.tsx"), "utf8");
  assert.doesNotMatch(src, /\|\s*\$1,995 Flat\s*\|\s*Sitesinc/);
  assert.match(src, /Small Business Websites in \$\{city\.name\}, \$\{city\.state\}`/);
  const { getLocationCities } = await import("../lib/locations.ts");
  for (const city of getLocationCities()) {
    const title = `Small Business Websites in ${city.name}, ${city.state}`;
    assert.ok(title.length <= 60, `${city.slug} title is ${title.length}: ${title}`);
  }
});

test("factory hub metadata is self-referencing (canonical + og:url)", async () => {
  const { metadataForFactoryPage } = await import("../lib/factory/page-metadata.ts");
  for (const slug of HUB_PATHS.map((p) => p.slice(1))) {
    const meta = metadataForFactoryPage(
      { title: "T", metaDescription: "D", path: `/${slug}`, slug },
      { blockIndexing: false }
    );
    assert.equal(meta.alternates?.canonical, `/${slug}`);
    assert.equal(meta.openGraph?.url, `/${slug}`);
    assert.deepEqual(meta.robots, { index: true, follow: true });
  }
});

test("nav, footer, home, services, and city pages link the six hub URLs", () => {
  const nav = readFileSync(path.join(ROOT, "lib/site-nav.ts"), "utf8");
  const footer = readFileSync(path.join(ROOT, "components/Footer.tsx"), "utf8");
  const home = readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
  const services = readFileSync(path.join(ROOT, "app/services/page.tsx"), "utf8");
  const city = readFileSync(path.join(ROOT, "app/locations/[slug]/page.tsx"), "utf8");
  const hubLinks = readFileSync(path.join(ROOT, "components/HubLinks.tsx"), "utf8");

  for (const href of HUB_PATHS) {
    assert.match(nav, new RegExp(`href: "${href}"`));
    assert.match(hubLinks, new RegExp(`"${href}"`));
  }
  assert.match(footer, /SITE_HUB_LINKS/);
  assert.match(home, /<HubLinks/);
  assert.match(services, /<HubLinks/);
  assert.match(city, /href="\/website-design"/);
  assert.match(city, /href="\/packages"/);
  assert.match(nav, /href: "\/website-design"/);
  assert.match(nav, /href: "\/packages"/);
});

test("Service/Offer JSON-LD parses; FAQPage only when FAQs are passed", async () => {
  const { buildServiceJsonLd, serializeJsonLd } = await import("../lib/service-jsonld.ts");
  const withFaqs = buildServiceJsonLd({
    name: "Website build",
    description: "Custom Next.js site",
    path: "/services",
    faqs: [{ question: "How much?", answer: "Website builds are $1,995." }],
  });
  const withoutFaqs = buildServiceJsonLd({
    name: "Website build",
    description: "Custom Next.js site",
    path: "/website-design",
  });
  const a = JSON.parse(serializeJsonLd(withFaqs).replace(/\\u003c/g, "<"));
  const b = JSON.parse(serializeJsonLd(withoutFaqs).replace(/\\u003c/g, "<"));
  assert.equal(a["@context"], "https://schema.org");
  assert.ok(a["@graph"].some((n) => n["@type"] === "Service"));
  assert.ok(a["@graph"].some((n) => n["@type"] === "FAQPage"));
  assert.equal(a["@graph"].find((n) => n["@type"] === "Service").offers["@type"], "Offer");
  assert.equal(a["@graph"].find((n) => n["@type"] === "Service").offers.price, "1995");
  assert.ok(!b["@graph"].some((n) => n["@type"] === "FAQPage"));
  assert.match(readFileSync(path.join(ROOT, "app/services/page.tsx"), "utf8"), /<ServiceJsonLd/);
  assert.match(readFileSync(path.join(ROOT, "lib/factory/publish.tsx"), "utf8"), /<ServiceJsonLd/);
});

test("sitemap lastmod is per-page, not one build date on every URL", async () => {
  process.env.SITESINC_STORE = "local";
  const { default: sitemap } = await import("../app/sitemap.ts");
  const { lastmodFor, LOCATION_PAGES_LASTMOD, SITE_FALLBACK_LASTMOD } = await import("../lib/sitemap-dates.ts");
  const entries = await sitemap();
  const dates = new Set(entries.map((e) => {
    const value = e.lastModified;
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }));
  assert.ok(dates.size >= 2, `expected mixed lastmod dates, got ${[...dates]}`);
  assert.equal(lastmodFor("/blog/diy-vs-done-for-you-websites"), "2024-08-05");
  assert.equal(lastmodFor("/locations/new-york-ny"), LOCATION_PAGES_LASTMOD);
  assert.equal(lastmodFor("/unknown-future-path"), SITE_FALLBACK_LASTMOD);
  assert.notEqual(lastmodFor("/"), lastmodFor("/blog/diy-vs-done-for-you-websites"));
});

test("robots.txt has no unused Host line", () => {
  const robots = readFileSync(path.join(ROOT, "app/robots.ts"), "utf8");
  assert.doesNotMatch(robots, /\bhost\s*:/);
  assert.match(robots, /sitemap: "https:\/\/sitesinc\.co\/sitemap\.xml"/);
});

test("business address is 1986 South Coast Hwy #3632 everywhere it is stated", () => {
  const content = JSON.parse(readFileSync(path.join(ROOT, "content.json"), "utf8"));
  assert.equal(content.footer.address.street, "1986 South Coast Hwy #3632");
  assert.equal(content.footer.address.city, "Laguna Beach");
  assert.equal(content.footer.address.region, "CA");
  assert.equal(content.footer.address.postalCode, "92651");
  assert.equal(content.footer.phone, "(909) 378-6404");
  assert.equal(content.footer.email, "save@sitesinc.co");
  const schema = readFileSync(path.join(ROOT, "components/OrgJsonLd.tsx"), "utf8")
    + readFileSync(path.join(ROOT, "components/SeoJsonLd.tsx"), "utf8")
    + readFileSync(path.join(ROOT, "components/Footer.tsx"), "utf8");
  assert.match(schema, /footer\.address\.street/);
  const scan = [
    "content.json",
    "app/terms/page.tsx",
    "app/privacy/page.tsx",
    "components/Footer.tsx",
    "components/OrgJsonLd.tsx",
    "components/SeoJsonLd.tsx",
  ].map((f) => readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  assert.doesNotMatch(scan, /1968 South Coast Hwy/);
  assert.match(scan, /1986 South Coast Hwy #3632/);
});

test("keywords appear in titles and copy without changing the $1,995 hook", async () => {
  const content = JSON.parse(readFileSync(path.join(ROOT, "content.json"), "utf8"));
  assert.match(content.seo.title, /Affordable Website Design/);
  assert.equal(content.hero.headline, "We build real, working websites, not subscriptions like the rest.");
  assert.match(content.hero.subheadline, /contractors, plumbers, barbers/);
  assert.match(content.hero.subheadline, /SEO for small business/);
  assert.match(content.hero.offer.title, /\$1,995/);
  const { PAGE_DRAFTS } = await import("../lib/factory/drafts.ts");
  assert.match(PAGE_DRAFTS["website-design"].title, /Affordable Website Design/);
  assert.match(PAGE_DRAFTS["seo-ready-websites"].title, /SEO for Small Business/);
  assert.match(PAGE_DRAFTS["for-local-service-businesses"].title, /Contractors, Plumbers, Barbers/);
  assert.match(PAGE_DRAFTS["website-design"].body, /affordable website design/i);
  assert.match(PAGE_DRAFTS["for-local-service-businesses"].body, /plumbers/);
});
