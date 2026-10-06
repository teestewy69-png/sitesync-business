// Path A (2026-10-05): the public offer is ONLY the $1,995 website build (50% to start, 50% at launch) and optional
// $129/month monitoring. SiteFlow is paused behind SITEFLOW_ENABLED (default off).
// Checks the flag, the paused routes (middleware), the public catalog, and scans public copy for retired claims.
//   node --test scripts/offer-copy.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { readFileSync, readdirSync, statSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete process.env.SITEFLOW_ENABLED;
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
process.env.SITESINC_STORE = "local";

const flag = await import("../lib/siteflow/flag.ts");
const offer = await import("../lib/offer-copy.ts");
const pub = await import("../lib/public-catalog.ts");
const products = await import("../data/products.ts");
const { quoteCart } = await import("../lib/catalog.ts");
const { plainRegistrarUrl, REGISTRAR_SLUGS } = await import("../lib/affiliates.ts");
const { PUBLIC_PATHS } = await import("../lib/factory/pipeline.ts");
const { default: sitemap } = await import("../app/sitemap.ts");
const { middleware } = await import("../middleware.ts");
const { NextRequest } = await import("next/server");

function withEnv(value, fn) {
  const prev = process.env.SITEFLOW_ENABLED;
  if (value === undefined) delete process.env.SITEFLOW_ENABLED;
  else process.env.SITEFLOW_ENABLED = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.SITEFLOW_ENABLED;
    else process.env.SITEFLOW_ENABLED = prev;
  }
}

async function withEnvAsync(value, fn) {
  const prev = process.env.SITEFLOW_ENABLED;
  if (value === undefined) delete process.env.SITEFLOW_ENABLED;
  else process.env.SITEFLOW_ENABLED = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.SITEFLOW_ENABLED;
    else process.env.SITEFLOW_ENABLED = prev;
  }
}

/* ---------------------------------- flag ---------------------------------- */

test("flag: SiteFlow is off unless SITEFLOW_ENABLED is true/1", () => {
  assert.equal(flag.siteflowEnabled({}), false);
  for (const v of ["", "0", "false", "yes", "on", "enabled"]) assert.equal(flag.siteflowEnabled({ SITEFLOW_ENABLED: v }), false, v);
  for (const v of ["true", "TRUE", " 1 "]) assert.equal(flag.siteflowEnabled({ SITEFLOW_ENABLED: v }), true, v);
  assert.equal(flag.SITEFLOW_PAUSED_LABEL, "Paused (phase 2)");
});

test("flag: SiteFlow-only paths", () => {
  for (const p of [
    "/go", "/go/namecheap", "/tools", "/tools/", "/cart", "/checkout", "/api/checkout", "/api/download/abc.def",
    "/api/stripe/webhook", "/api/siteflow/ref", "/api/factory/siteflow", "/api/factory/siteflow/payouts",
    "/api/factory/siteflow/upload",
  ]) {
    assert.equal(flag.isSiteflowPath(p), true, p);
  }
  for (const p of [
    "/", "/shop", "/shop/product/financial-consulting", "/thank-you", "/api/inquiry", "/api/subscribe", "/api/products",
    "/api/health", "/app", "/api/factory/domainiq", "/api/factory/city-launch", "/gopher", "/toolsets", "/packages",
  ]) {
    assert.equal(flag.isSiteflowPath(p), false, p);
  }
  assert.equal(flag.siteflowPausedResponse().status, 404);
});

/* ------------------------------- middleware -------------------------------- */

async function hit(url, method = "GET") {
  return middleware(new NextRequest(url, { method, headers: { host: new URL(url).host } }));
}

test("middleware: paused SiteFlow routes 404 and ?ref= does nothing", async () => {
  await withEnvAsync(undefined, async () => {
    for (const p of ["/go/namecheap?d=acme.com", "/tools", "/cart", "/checkout", "/api/download/x.y", "/api/siteflow/ref?code=jane"]) {
      const res = await hit(`https://sitesinc.co${p}`);
      assert.equal(res.status, 404, p);
    }
    for (const p of ["/api/stripe/webhook", "/api/checkout", "/api/factory/siteflow"]) {
      assert.equal((await hit(`https://sitesinc.co${p}`, "POST")).status, 404, p);
    }
    const ref = await hit("https://sitesinc.co/?ref=jane");
    assert.notEqual(ref.status, 307);
    assert.equal(ref.headers.get("location"), null);
    assert.equal(ref.headers.get("x-middleware-next"), "1");
    assert.equal(ref.headers.get("set-cookie"), null);
    const home = await hit("https://sitesinc.co/");
    assert.equal(home.headers.get("x-middleware-next"), "1");
  });
});

test("middleware: SITEFLOW_ENABLED=true restores ref capture (code kept for phase 2)", async () => {
  await withEnvAsync("true", async () => {
    const ref = await hit("https://sitesinc.co/?ref=jane");
    assert.equal(ref.status, 307);
    assert.match(ref.headers.get("location") || "", /\/api\/siteflow\/ref\?code=jane/);
    assert.notEqual((await hit("https://sitesinc.co/tools")).status, 404);
  });
});

/* --------------------------------- catalog --------------------------------- */

test("public catalog while paused: only the two contact-only inquiries, nothing purchasable", () => {
  const visible = pub.visibleProducts({});
  assert.deepEqual(visible.map((p) => p.slug).sort(), ["financial-consulting", "gold-filled-jewelry"]);
  assert.ok(visible.every((p) => p.contactOnly === true));
  assert.equal(pub.anythingPurchasable({}), false);
  for (const p of products.products) assert.equal(pub.canBuyOnline(p, {}), false, p.slug);
  assert.equal(pub.visibleProduct("website-monitoring", {}), undefined);
  assert.equal(pub.visibleProduct("keep-it-earning-kit", {}), undefined);
  withEnv(undefined, () => assert.throws(() => quoteCart([{ slug: "financial-consulting", quantity: 1 }]), /not available/));
});

test("catalog: the 4 deleted bundles and the retired website bundle are gone everywhere", () => {
  for (const gone of ["mack-makeup-bundle", "home-gym-bundle", "home-pet-grooming-kit", "longevity-life-bundle", "website-design-digital-bundle"]) {
    assert.equal(products.getCatalogEntry(gone), undefined, gone);
  }
  const blob = readFileSync(path.join(ROOT, "data/products.ts"), "utf8");
  assert.doesNotMatch(blob, /website-design-bundle\.jpg|website-design-digital-bundle"/);
  const assets = readdirSync(path.join(ROOT, "public/products"));
  for (const a of assets) assert.doesNotMatch(a, /website-design|makeup|gym|pet-grooming|longevity/, a);
});

test("DomainIQ bay registrar links while paused are plain registrar URLs (no /go, no affiliate template)", () => {
  for (const slug of REGISTRAR_SLUGS) {
    const url = plainRegistrarUrl(slug, "acme-plumbing.com");
    assert.match(url, /^https:\/\/(www\.)?[a-z]+\.com\//, slug);
    assert.ok(!url.includes("/go/"), slug);
    assert.ok(url.includes("acme-plumbing.com"), slug);
  }
});

/* ------------------------------ sitemap / nav ------------------------------ */

test("sitemap and public paths: no /cart, /checkout or /shop while nothing is purchasable", () => {
  assert.ok(!PUBLIC_PATHS.includes("/cart"));
  assert.ok(!PUBLIC_PATHS.includes("/checkout"));
  const urls = withEnv(undefined, () => sitemap()).map((e) => e.url);
  assert.ok(urls.includes("https://sitesinc.co"));
  for (const u of urls) assert.doesNotMatch(u, /\/(cart|checkout|shop|tools|go)(\/|$)/, u);
  const footer = readFileSync(path.join(ROOT, "components/Footer.tsx"), "utf8");
  assert.doesNotMatch(footer, /href="\/(shop|cart|checkout)"/);
});

/* ------------------------------- public copy ------------------------------- */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|json)$/.test(name)) out.push(full);
  }
  return out;
}

// Always-public copy. (The product page's paid-fulfillment line and the thank-you order states only render when
// SiteFlow is enabled; the built HTML is spot-checked separately.)
const PUBLIC_SOURCES = [
  "content.json",
  "data/faq.ts",
  "data/process.ts",
  "data/posts.ts",
  "app/page.tsx",
  "app/terms/page.tsx",
  "app/privacy/page.tsx",
  "app/shop/page.tsx",
  "lib/factory/drafts.ts",
  "lib/design-styles.ts",
  ...walk(path.join(ROOT, "app/blog")).map((f) => path.relative(ROOT, f)),
  ...readdirSync(path.join(ROOT, "components"))
    .filter((n) => n.endsWith(".tsx"))
    .map((n) => `components/${n}`),
  ...readdirSync(path.join(ROOT, "components/shop")).map((n) => `components/shop/${n}`),
];

test("public copy: no retired monetization claims (Path A)", () => {
  for (const rel of PUBLIC_SOURCES) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    assert.equal(offer.findRetiredOfferClaim(text), null, `${rel}: "${offer.findRetiredOfferClaim(text)}"`);
  }
});

test("pricing: only the $1,995 build (50/50) and optional $129/mo monitoring", () => {
  const content = JSON.parse(readFileSync(path.join(ROOT, "content.json"), "utf8"));
  assert.equal(content.pricing.build.startingPrice, offer.PATH_A_OFFER.buildFrom);
  assert.equal(content.pricing.build.startDue, offer.PATH_A_OFFER.startDue);
  assert.equal(content.pricing.build.launchDue, offer.PATH_A_OFFER.launchDue);
  assert.equal(content.pricing.maintenance.price, offer.PATH_A_OFFER.monitoring);
  assert.deepEqual(Object.keys(content.pricing).sort(), ["build", "maintenance", "subtitle", "title"]);
  assert.equal(content.productTeaser, undefined);
  const prices = JSON.stringify(content).match(/\$[0-9][0-9,]*(\.[0-9]{2})?/g) || [];
  for (const p of prices) assert.ok(["$1,995", "$997.50", "$129"].includes(p), `unexpected price ${p} in content.json`);
  const faq = readFileSync(path.join(ROOT, "data/faq.ts"), "utf8");
  assert.match(faq, /50% \(\$997\.50\) to start and 50% at launch/);
});

test("published factory pages carrying retired copy are replaced by the current draft", () => {
  assert.ok(offer.findRetiredOfferClaim("lead capture, monetization placeholders, Stripe if you sell"));
  assert.ok(offer.findRetiredOfferClaim("Pay in full through Stripe"));
  assert.equal(offer.findRetiredOfferClaim("Website builds start at $1,995. Pay 50% to start and 50% at launch."), null);
});
