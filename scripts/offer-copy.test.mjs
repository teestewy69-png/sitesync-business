// Path A (2026-10-05): the public offer is ONLY the $1,995 website build (50% to start, 50% at launch) and optional
// $129/month monitoring. SiteFlow is paused behind SITEFLOW_ENABLED (default off). The public shop was removed
// (2026-10-05): /shop and /shop/* 301 to /, the two contact-only items and their assets are gone.
// Checks the flag, the paused routes (middleware), the shop removal + redirects, and scans public copy for retired claims.
//   node --test scripts/offer-copy.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { existsSync, readFileSync, readdirSync, statSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete process.env.SITEFLOW_ENABLED;
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
process.env.SITESINC_STORE = "local";

const flag = await import("../lib/siteflow/flag.ts");
const offer = await import("../lib/offer-copy.ts");
const products = await import("../data/products.ts");
const { quoteCart } = await import("../lib/catalog.ts");
const { plainRegistrarUrl, REGISTRAR_SLUGS } = await import("../lib/affiliates.ts");
const { PUBLIC_PATHS } = await import("../lib/factory/pipeline.ts");
const { default: sitemap } = await import("../app/sitemap.ts");
const { middleware, isRemovedShopPath } = await import("../middleware.ts");
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
    "/", "/shop", "/shop/product/anything", "/thank-you", "/api/subscribe",
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

/* ------------------------------- shop removed ------------------------------- */

const SHOP_ITEMS = ["financial-consulting", "gold-filled-jewelry"];

test("shop removed: /shop and /shop/* 301 to / (flag on or off), other paths untouched", async () => {
  for (const value of [undefined, "true"]) {
    await withEnvAsync(value, async () => {
      for (const p of ["/shop", "/shop/", "/shop/product/financial-consulting", "/shop/product/gold-filled-jewelry?x=1", "/SHOP/cart"]) {
        const res = await hit(`https://sitesinc.co${p}`);
        assert.equal(res.status, 301, `${p} (SITEFLOW_ENABLED=${value})`);
        assert.equal(res.headers.get("location"), "https://sitesinc.co/", p);
      }
    });
  }
  for (const p of ["/shopping", "/shops", "/workshop", "/blog/shop"]) assert.equal(isRemovedShopPath(p), false, p);
  const home = await hit("https://sitesinc.co/");
  assert.notEqual(home.status, 301);
  // Client real domains keep their own routing: no Sitesinc shop redirect there.
  assert.notEqual((await hit("https://desertflow-plumbing.com/shop")).status, 301);
});

test("shop removed: pages, components, inquiry form, /api/products, /api/inquiry and assets are gone", () => {
  for (const rel of ["app/shop", "components/shop", "app/api/products", "app/api/inquiry", "lib/public-catalog.ts", "public/products"]) {
    assert.equal(existsSync(path.join(ROOT, rel)), false, rel);
  }
  const blob = readFileSync(path.join(ROOT, "data/products.ts"), "utf8");
  assert.doesNotMatch(blob, /jewel|gold|financial|affiliate sources/i);
  for (const slug of SHOP_ITEMS) assert.equal(products.getCatalogEntry(slug), undefined, slug);
  // Paused SiteFlow catalog: nothing public, nothing purchasable, checkout refuses while paused.
  assert.deepEqual(products.getPublicProducts(), []);
  for (const p of products.products) assert.equal(products.isPurchasable(p), false, p.slug);
  withEnv(undefined, () => assert.throws(() => quoteCart([{ slug: "website-monitoring", quantity: 1 }]), /not available/));
});

test("shop removed: no shop GA events (select_item / add_to_cart / begin_checkout); generate_lead kept for builds", () => {
  const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components")), ...walk(path.join(ROOT, "lib"))];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /["'](select_item|add_to_cart|begin_checkout|product_inquiry)["']/, path.relative(ROOT, f));
    assert.doesNotMatch(text, /trackSelectItem|trackAddToCart|trackBeginCheckout|data-analytics-cta="(product_teaser|proceed_to_checkout)"/, path.relative(ROOT, f));
  }
  assert.match(readFileSync(path.join(ROOT, "lib/analytics.ts"), "utf8"), /trackEvent\("generate_lead"/);
  assert.match(readFileSync(path.join(ROOT, "components/EmailCapture.tsx"), "utf8"), /trackLead\("website_build_request"/);
});

test("catalog: the 4 deleted bundles and the retired website bundle are gone everywhere", () => {
  for (const gone of ["mack-makeup-bundle", "home-gym-bundle", "home-pet-grooming-kit", "longevity-life-bundle", "website-design-digital-bundle"]) {
    assert.equal(products.getCatalogEntry(gone), undefined, gone);
  }
  const blob = readFileSync(path.join(ROOT, "data/products.ts"), "utf8");
  assert.doesNotMatch(blob, /website-design-bundle\.jpg|website-design-digital-bundle"/);
  assert.equal(existsSync(path.join(ROOT, "public/products")), false);
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

test("sitemap and public paths: no /cart, /checkout or /shop", async () => {
  for (const p of PUBLIC_PATHS) assert.doesNotMatch(p, /^\/(cart|checkout|shop)(\/|$)/, p);
  const urls = (await withEnvAsync(undefined, () => sitemap())).map((e) => e.url);
  assert.ok(urls.includes("https://sitesinc.co"));
  for (const u of urls) assert.doesNotMatch(u, /\/(cart|checkout|shop|tools|go)(\/|$)/, u);
  for (const pathName of ["/services", "/about", "/contact", "/locations"]) {
    assert.ok(PUBLIC_PATHS.includes(pathName), pathName);
    assert.ok(urls.includes(`https://sitesinc.co${pathName}`), pathName);
  }
  const footer = readFileSync(path.join(ROOT, "components/Footer.tsx"), "utf8");
  assert.doesNotMatch(footer, /href="\/(shop|cart|checkout)"/);
  const robots = readFileSync(path.join(ROOT, "app/robots.ts"), "utf8");
  assert.doesNotMatch(robots, /\/shop/, "robots must not block /shop: crawlers need to see the 301");
});

test("Sitesinc public site has the same page types as the general client template", async () => {
  const { CLIENT_TEMPLATES } = await import("../lib/factory/client-templates.ts");
  const general = CLIENT_TEMPLATES.find((t) => t.id === "general");
  assert.ok(general, "general template");
  for (const page of general.pages) {
    const route = page.path === "/" ? "app/page.tsx" : `app${page.path}/page.tsx`;
    assert.ok(existsSync(path.join(ROOT, route)), route);
    if (page.path !== "/") assert.ok(PUBLIC_PATHS.includes(page.path), page.path);
  }
  const contact = readFileSync(path.join(ROOT, "app/contact/page.tsx"), "utf8");
  assert.ok(existsSync(path.join(ROOT, "app/locations/page.tsx")));
  assert.ok(existsSync(path.join(ROOT, "app/locations/[citySlug]/page.tsx")));
  assert.match(contact, /EmailCapture/);
  const form = readFileSync(path.join(ROOT, "components/EmailCapture.tsx"), "utf8");
  assert.match(form, /\/api\/subscribe/);
});

test("production surfaces include the general-template pages for a Sitesinc production publish", async () => {
  const { PRODUCTION_SURFACES } = await import("../lib/factory/surfaces.ts");
  const template = PRODUCTION_SURFACES.find((s) => s.id === "template_pages");
  assert.ok(template, "template_pages surface");
  assert.deepEqual([...template.paths], ["/services", "/about", "/contact"]);
  assert.equal(template.slugs.length, 0, "template pages are Next.js routes, not factory hub slugs");
  assert.ok(PRODUCTION_SURFACES.find((s) => s.id === "service_pages"));
  assert.ok(PRODUCTION_SURFACES.find((s) => s.id === "industry_pages"));
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
  "app/about/page.tsx",
  "app/services/page.tsx",
  "app/contact/page.tsx",
  "app/terms/page.tsx",
  "app/privacy/page.tsx",
  "lib/factory/drafts.ts",
  "lib/design-styles.ts",
  ...walk(path.join(ROOT, "app/blog")).map((f) => path.relative(ROOT, f)),
  ...readdirSync(path.join(ROOT, "components"))
    .filter((n) => n.endsWith(".tsx"))
    .map((n) => `components/${n}`),
];

test("public copy: no retired monetization claims (Path A)", () => {
  for (const rel of PUBLIC_SOURCES) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    assert.equal(offer.findRetiredOfferClaim(text), null, `${rel}: "${offer.findRetiredOfferClaim(text)}"`);
  }
});

test("pricing: only the $1,995 build (50/50) and optional $129/mo monitoring", () => {
  const content = JSON.parse(readFileSync(path.join(ROOT, "content.json"), "utf8"));
  assert.equal(content.pricing.build.price, offer.PATH_A_OFFER.buildFrom);
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
  assert.ok(offer.findRetiredOfferClaim("Website builds start at $1,995. Pay 50% to start and 50% at launch."));
  assert.ok(offer.findRetiredOfferClaim("Request a quote for your website"));
  assert.ok(offer.findRetiredOfferClaim("a flat fee, no quotes, no negotiation"));
  assert.equal(offer.findRetiredOfferClaim("Website builds are $1,995. Pay 50% to start and 50% at launch."), null);
});

test("public copy: $1,995 is a flat fee, not a starting price or quote", () => {
  const BANNED = /start(ing)? at \$|\bstarting price\b|from \$1,?995|\bno quotes\b|\b(get|request|ask for) (a )?quote\b|\bfree quotes?\b/i;
  for (const rel of PUBLIC_SOURCES) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    assert.doesNotMatch(text, BANNED, rel);
  }
});

test("email catcher: popup is mounted and intercepts start-build clicks", () => {
  const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
  assert.match(layout, /<EmailCatcher\s*\/>/);
  const catcher = readFileSync(path.join(ROOT, "components/EmailCatcher.tsx"), "utf8");
  assert.match(catcher, /isEmailCatcherTrigger/);
  assert.match(catcher, /layout="dialog"/);
  const capture = readFileSync(path.join(ROOT, "components/EmailCapture.tsx"), "utf8");
  assert.match(capture, /layout === "dialog"/);
  assert.match(capture, /email-catcher-title/);
  const hero = readFileSync(path.join(ROOT, "components/Hero.tsx"), "utf8");
  assert.match(hero, /data-email-catcher="true"/);
  assert.match(hero, /data-analytics-cta="start_build"/);
  const pricing = readFileSync(path.join(ROOT, "components/Pricing.tsx"), "utf8");
  assert.match(pricing, /data-email-catcher="true"/);
  const content = JSON.parse(readFileSync(path.join(ROOT, "content.json"), "utf8"));
  assert.equal(content.emailCapture.popupOverline, "Before you go");
  assert.equal(content.emailCapture.popupTitle, "Leave your name and email first.");
  assert.match(content.emailCapture.popupSubtitle, /request, not a purchase/);
  const nextConfig = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
  assert.match(nextConfig, /allowedDevOrigins:\s*\["127\.0\.0\.1"\]/);
});

test("email catcher: start-build and #checklist clicks are caught; factory and contact stay quiet", async () => {
  const catcher = await import("../lib/email-catcher.ts");
  assert.equal(catcher.EMAIL_CATCHER_AUTO_OPEN_MS, 5000);
  assert.equal(catcher.isEmailCatcherTrigger({ catcher: "true" }), true);
  assert.equal(catcher.isEmailCatcherTrigger({ href: "/#checklist" }), true);
  assert.equal(catcher.isEmailCatcherTrigger({ href: "#checklist" }), true);
  assert.equal(catcher.isEmailCatcherTrigger({ cta: "start_build" }), true);
  assert.equal(catcher.isEmailCatcherTrigger({ href: "/#pricing" }), false);
  assert.equal(catcher.isEmailCatcherTrigger({ catcher: "off", href: "/#checklist" }), false);
  assert.equal(
    catcher.isEmailCatcherTrigger({ href: "/#checklist", insideCatcher: true }),
    false
  );
  assert.equal(catcher.isEmailCatcherInternalPath("/app"), true);
  assert.equal(catcher.isEmailCatcherInternalPath("/demo/client/x"), true);
  assert.equal(catcher.isEmailCatcherInternalPath("/"), false);
  assert.equal(catcher.shouldAutoOpenEmailCatcher("/"), true);
  assert.equal(catcher.shouldAutoOpenEmailCatcher("/services"), true);
  assert.equal(catcher.shouldAutoOpenEmailCatcher("/contact"), false);
  assert.equal(catcher.shouldAutoOpenEmailCatcher("/app"), false);
});
