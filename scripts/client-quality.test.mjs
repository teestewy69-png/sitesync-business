// Niche-aware competitor gaps, directory skipping, full client drafts, no stray emergency page, business-fact check.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);
const { default: test } = await import("node:test");
const assert = (await import("node:assert/strict")).default;
const C = await import("../lib/factory/flip/competitors.ts");
const T = await import("../lib/factory/client-templates.ts");
const K = await import("../lib/factory/client-checks.ts");
const D = await import("../lib/factory/client-drafts.ts");

const page = (url, extra = "") => C.parseCompetitorHtml(url, `<html><title>Web design</title><body><h2>Our process</h2><h2>Pricing</h2><p>${"word ".repeat(1000)} ${extra} get started</p></body></html>`);

test("directories are skipped and the next result is taken", () => {
  const urls = ["https://www.yelp.com/biz/x", "https://www.angi.com/a", "https://thumbtack.com/t", "https://www.bbb.org/b", "https://a.com/", "https://b.com/", "https://www.homeadvisor.com/h", "https://c.com/", "https://d.com/"];
  assert.deepEqual(C.pickTopUrls(urls), ["https://a.com/", "https://b.com/", "https://c.com/"]);
});

test("web-design niche gets web-design gaps, never flip topics", () => {
  const { gaps } = C.findWeaknesses([page("https://a.com"), page("https://b.com"), page("https://c.com")], 2026, { niche: "small business website design and SEO" });
  assert.ok(gaps.includes("local SEO / Google Business Profile"));
  assert.ok(!gaps.some((g) => /70%|ARV|hard money|flip/i.test(g)), gaps.join("|"));
  assert.ok(!gaps.includes("process steps"));
});

test("flip mode keeps flip topics; default (no niche) stays flip for back-compat", () => {
  assert.ok(C.topicsFor({ mode: "flip" }).some(([t]) => t === "the 70% rule"));
  assert.ok(C.topicsFor({ niche: "house flipping" }).some(([t]) => t === "ARV and comps"));
  assert.ok(!C.topicsFor({ niche: "plumbing" }).some(([t]) => t === "ARV and comps"));
  assert.ok(C.findWeaknesses([page("https://a.com")], 2026).gaps.includes("the 70% rule"));
});

test("analyzeCompetitors with a client niche reports niche gaps and skips Yelp", async () => {
  const f = async (url) => url.includes("serper")
    ? { ok: true, status: 200, json: async () => ({ organic: [{ link: "https://www.yelp.com/x" }, { link: "https://a.com" }, { link: "https://b.com" }, { link: "https://c.com" }] }), text: async () => "" }
    : { ok: true, status: 200, text: async () => `<title>x</title><h2>Pricing</h2><p>${"w ".repeat(1000)}</p>`, json: async () => ({}) };
  const a = await C.analyzeCompetitors("web design Inland Empire", { env: { SERPER_API_KEY: "k" }, fetchImpl: f, niche: "web design", nowYear: 2026 });
  assert.deepEqual(a.competitors.map((c) => c.url), ["https://a.com", "https://b.com", "https://c.com"]);
  assert.ok(!a.gaps.some((g) => /70%|ARV/.test(g)));
  assert.ok(!/calculators/.test(C.competitorPromptBlock(a)));
});

test("emergency page only for emergency niches", () => {
  const web = T.templatePagesFor("local-service", "small business website design").map((p) => p.slug);
  assert.ok(!web.includes("emergency")); assert.ok(web.includes("about"));
  assert.ok(T.templatePagesFor("local-service", "plumbing").some((p) => p.slug === "emergency"));
});

const cfg = { mode: "client", businessName: "Sitesinc", contactName: "", email: "hi@sitesinc.co", niche: "small business website design", businessType: "", city: "Laguna Beach", state: "CA", phone: "(909) 378-6404", primaryGoal: "Get more calls / leads", notes: "", offer: "Websites for small businesses", pricingNote: "$1,995 flat, 50% to start and 50% at launch; monitoring first month free, then $129/mo", domain: "sitesinc.co", monitoringInterest: true, designStyleId: "funnel-ready", templateId: "local-service", seededPages: [] };

test("content drafts are full multi-section pages built from facts; length window is reported honestly", () => {
  for (const slug of ["home", "services", "about"]) {
    const brief = { id: "b", slug, title: slug, status: "ready_for_review", searchIntent: "", competitorUrls: [], wordCountGuidance: { min: 900, max: 1500, note: "" }, headings: [], recurringTopics: [], gaps: [], outline: [], citations: [], notes: "", approvedBy: "", approvedAt: "" };
    const d = D.draftFromClientBrief(brief, cfg);
    const len = K.checkPageLength(slug, d.body);
    assert.ok(len.words > 350, `${slug} ${len.message}`);
    assert.ok(["ok", "too_short"].includes(len.status));
    assert.match(d.body, /Frequently asked questions|How it works/);
    assert.doesNotMatch(d.body, /What this draft is not/);
    assert.equal(K.checkBusinessFacts(d.body, cfg, slug).issues.filter((i) => i.level === "error").length, 0);
  }
});

test("length windows: content 900-1500, contact/legal shorter", () => {
  assert.deepEqual([K.pageLengthTarget("services").min, K.pageLengthTarget("services").max], [900, 1500]);
  assert.equal(K.pageLengthTarget("contact").min, 250);
  assert.equal(K.checkPageLength("home", "short page").status, "too_short");
});

test("business-fact check flags wrong phone, unknown price, wrong street, missing location", () => {
  const bad = K.checkBusinessFacts("Call (909) 721-5236. Only $999! Visit 123 Main Street.", cfg, "contact");
  const facts = bad.issues.map((i) => `${i.level}:${i.fact}`);
  assert.equal(bad.status, "errors");
  assert.ok(facts.includes("error:phone") && facts.includes("error:price") && facts.includes("error:address"));
  assert.ok(facts.includes("warning:phone") && facts.includes("warning:address"));
  const good = K.checkBusinessFacts("Sitesinc, Laguna Beach. Call (909) 378-6404. $1,995 flat; $129/mo.", cfg, "contact");
  assert.equal(good.status, "ok", JSON.stringify(good.issues));
});

test("Sitesinc hub pages (6) match the offer facts: $1,995 50/50, monitoring 1st month free then $129/mo, phone", async () => {
  const { PAGE_DRAFTS } = await import("../lib/factory/drafts.ts");
  const offer = { phone: "(909) 378-6404", pricingNote: "$1,995 flat, 50% to start ($997.50) and 50% at launch; monitored SEO 1st month free, then $129/mo; first year of monitoring $1,419 (11 x $129); DIY builder comparison $30-$50/mo" };
  const slugs = ["website-design", "packages", "website-redesign", "seo-ready-websites", "website-monitoring", "for-local-service-businesses"];
  for (const slug of slugs) {
    const d = PAGE_DRAFTS[slug];
    const text = `${d.body} ${d.metaDescription}`;
    assert.equal(K.checkBusinessFacts(text, offer, slug).status, "ok", slug + JSON.stringify(K.checkBusinessFacts(text, offer, slug).issues));
    assert.match(text, /\(909\) 378-6404/);
    assert.match(text, /1st month free, then \$129\/mo/);
    assert.match(text, /50% to start and 50% at launch/);
    assert.doesNotMatch(text, /1,548|721-5236/);
  }
});

test("store: only priced monitoring is public, 1st month free trial; DomainIQ and unpriced items hidden", async () => {
  const P = await import("../data/products.ts");
  const pub = P.getPublicProducts().map((p) => p.slug);
  assert.deepEqual(pub, ["website-monitoring"]);
  assert.equal(P.getProduct("domainiq-domain-report"), undefined);
  assert.equal(P.getProduct("website-monitoring").price, "1st month free, then $129.00/mo");
  const S = await import("../lib/stripe-checkout.ts");
  const params = S.buildCheckoutParams({ origin: "https://sitesinc.co", order: { id: "o1", email: "a@b.co", mode: "subscription", items: [{ slug: "website-monitoring", name: "Website monitoring", quantity: 1, unitAmount: 129, unitAmountCents: 12900, lineTotal: 129, kind: "subscription", interval: "month", trialDays: 30 }] } });
  assert.equal(params.subscription_data.trial_period_days, 30);
  assert.equal(params.line_items[0].price_data.unit_amount, 12900);
});
