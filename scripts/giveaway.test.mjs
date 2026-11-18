// Giveaway: /giveaway entry for "The SitesInc Website Giveaway".
// Covers the prize math against the real store catalog (Gate-2 clean: the
// values are the products' actual listed prices), the rules copy (free entry,
// no purchase necessary), entry validation, the real dedupe-by-email entry
// flow against the local JSON store in a temp dir, the confirmation email
// copy, and the /api/giveaway route (honeypot + happy path). No network, no
// SMTP (env cleared on purpose: mail reports "not_configured" and the saved
// lead stays the source of truth).
//   node --test scripts/giveaway.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { mkdtempSync, rmSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Isolate every store write (lib/persistence.ts resolves data/ from cwd at import time).
const REPO_CWD = process.cwd();
const TMP = mkdtempSync(path.join(tmpdir(), "giveaway-test-"));
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.TITAN_SMTP_USER;
delete process.env.TITAN_SMTP_PASS;
delete process.env.DEPLOY_PRIME_URL;
delete process.env.URL;
delete process.env.NEXT_PUBLIC_SITE_URL;
process.env.SITESINC_STORE = "local";
process.chdir(TMP);

const giveaway = await import("../lib/giveaway.ts");
const store = await import("../lib/store.ts");
const { PUBLIC_PATHS } = await import("../lib/factory/pipeline.ts");
const route = await import("../app/api/giveaway/route.ts");

test.after(() => {
  process.chdir(REPO_CWD);
  rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------- prize math ------------------------------ */

test("prize: Tony's terms — $1,995 build for $200, newsletter, two ebooks", () => {
  const guides = giveaway.prizeGuides();
  assert.equal(giveaway.GIVEAWAY_SOURCE, "giveaway-2026");
  assert.equal(giveaway.WEBSITE_BUILD_VALUE_CENTS, 199_500);
  assert.equal(giveaway.WINNER_PRICE_CENTS, 20_000);
  assert.equal(giveaway.NEWSLETTER_MONTHS, 6);
  assert.equal(giveaway.EBOOK_PICK_COUNT, 2);
  assert.ok(guides.length >= 10, `expected the full guide library to pick from, got ${guides.length}`);
  assert.ok(guides.every((g) => g.priceCents > 0), "every library guide carries a real price");
  assert.ok(
    guides.some((g) => g.slug === "website-audit-kit"),
    "the Website Audit Kit is in the library"
  );
  assert.ok(
    !guides.some((g) => g.slug === "website-monitoring"),
    "the monitoring subscription is not a library ebook"
  );
});

test("rules: free entry stated, draw dates consistent, Gate-2 clean", () => {
  const rules = giveaway.GIVEAWAY_RULES.join(" ").toLowerCase();
  assert.ok(rules.includes("no purchase necessary"));
  assert.ok(rules.includes("one entry per email"));
  assert.ok(giveaway.ENTRIES_CLOSE_TEXT.includes("November 26, 2026"));
  assert.ok(giveaway.DRAW_DATE_TEXT.includes("November 27, 2026"));
  for (const banned of ["guarantee", "get rich", "make money fast", "six figures"]) {
    assert.ok(!rules.includes(banned), `rules must not contain "${banned}"`);
  }
});

test("routing: /giveaway is a public path (sitemap)", () => {
  assert.ok(PUBLIC_PATHS.includes("/giveaway"));
});

/* ------------------------------ validation ------------------------------- */

test("parseGiveawayEntry: trims, lowercases email, keeps business name + kind", () => {
  const parsed = giveaway.parseGiveawayEntry({
    name: "  Jo  ",
    email: "  Jo@Example.COM ",
    businessName: "  Jo's Grooming  ",
    businessKind: " Dog grooming ",
  });
  assert.deepEqual(parsed, {
    ok: true,
    entry: {
      name: "Jo",
      email: "jo@example.com",
      businessName: "Jo's Grooming",
      businessKind: "Dog grooming",
    },
  });
});

test("parseGiveawayEntry: business kind is optional, business name is not", () => {
  const ok = giveaway.parseGiveawayEntry({
    name: "Jo",
    email: "jo@example.com",
    businessName: "Jo's Grooming",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.entry.businessKind, undefined);
  assert.equal(
    giveaway.parseGiveawayEntry({ name: "Jo", email: "jo@example.com" }).ok,
    false,
    "an entry without a business is not an entry"
  );
});

test("parseGiveawayEntry: rejects missing name and bad emails", () => {
  assert.equal(
    giveaway.parseGiveawayEntry({ email: "jo@example.com", businessName: "Shop" }).ok,
    false
  );
  assert.equal(
    giveaway.parseGiveawayEntry({ name: "Jo", email: "not-an-email", businessName: "Shop" }).ok,
    false
  );
  assert.equal(
    giveaway.parseGiveawayEntry({ name: "Jo", email: "", businessName: "Shop" }).ok,
    false
  );
});

/* --------------------------- confirmation email --------------------------- */

test("confirmationEmail: states the prize, the draw, and the free checklist", () => {
  const mail = giveaway.confirmationEmail("Jo", "https://sitesinc.co");
  assert.equal(mail.subject, "You're entered in the SitesInc Website Giveaway");
  assert.ok(mail.text.startsWith("Hi Jo,"));
  assert.ok(mail.text.includes("$1,995"));
  assert.ok(mail.text.includes("for just $200"));
  assert.ok(mail.text.includes("monthly newsletter"));
  assert.ok(mail.text.includes("Any two ebooks"));
  assert.ok(mail.text.includes("Friday, November 27, 2026"));
  assert.ok(mail.text.includes("no purchase is necessary"));
  assert.ok(mail.text.includes("https://sitesinc.co/start/checklist"));
  assert.ok(mail.text.includes("https://sitesinc.co/new-business-website-starter-checklist.pdf"));
  assert.ok(mail.text.includes("(909) 323-1575"));
  assert.ok(mail.text.includes("1968 South Coast Hwy #3632, Laguna Beach, CA 92651"));
  assert.ok(mail.text.includes("save@sitesinc.co"));
});

/* ---------------------------- entry flow (store) ---------------------------- */

test("handleGiveawayEntry: invalid body -> 400 and nothing is stored", async () => {
  const result = await giveaway.handleGiveawayEntry({ name: "", email: "nope" });
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  const leads = (await store.listLeads()).filter((l) => l.source === giveaway.GIVEAWAY_SOURCE);
  assert.equal(leads.length, 0);
});

test("handleGiveawayEntry: saves one entry tagged giveaway-2026 with the business", async () => {
  const result = await giveaway.handleGiveawayEntry(
    { name: "Jo", email: "Jo@Example.com", businessName: "Jo's Grooming", businessKind: "Dog grooming" },
    "https://sitesinc.co"
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.source === giveaway.GIVEAWAY_SOURCE);
  assert.equal(leads.length, 1);
  const lead = leads[0];
  assert.equal(lead.name, "Jo");
  assert.equal(lead.email, "jo@example.com");
  assert.equal(lead.details, "Giveaway entry: Jo's Grooming (Dog grooming)");
  assert.ok(lead.createdAt, "timestamp kept");
  // No SMTP in the test env: the lead records that the email could not configure-send.
  assert.equal(lead.notificationState, "not_configured");
  assert.equal(result.body.warning !== undefined, true);
});

test("handleGiveawayEntry: same email twice = one entry, refreshed, original date kept", async () => {
  const before = (await store.listLeads()).find((l) => l.source === giveaway.GIVEAWAY_SOURCE);
  const result = await giveaway.handleGiveawayEntry(
    { name: "Joanna", email: "jo@example.com", businessName: "Jo's Mobile Grooming" },
    "https://sitesinc.co"
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.reused, true);
  const leads = (await store.listLeads()).filter((l) => l.source === giveaway.GIVEAWAY_SOURCE);
  assert.equal(leads.length, 1, "duplicate entry must not create a second lead");
  assert.equal(leads[0].id, before.id);
  assert.equal(leads[0].name, "Joanna");
  assert.equal(leads[0].details, "Giveaway entry: Jo's Mobile Grooming");
  assert.equal(leads[0].createdAt, before.createdAt);
});

test("handleGiveawayEntry: a different email is a different entrant", async () => {
  const result = await giveaway.handleGiveawayEntry({
    name: "Sam",
    email: "sam@example.com",
    businessName: "Sam's Bakery",
  });
  assert.equal(result.body.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.source === giveaway.GIVEAWAY_SOURCE);
  assert.equal(leads.length, 2);
});

/* --------------------------------- route --------------------------------- */

function fakeRequest(body) {
  return {
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": "203.0.113.10" }),
    nextUrl: { origin: "https://sitesinc.co" },
    json: async () => body,
    formData: async () => new FormData(),
  };
}

test("route POST: honeypot submissions are dropped silently (ok, nothing stored)", async () => {
  const res = await route.POST(
    fakeRequest({ name: "Bot", email: "bot@example.com", businessName: "Spam Co", company_website: "http://spam" })
  );
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.email === "bot@example.com");
  assert.equal(leads.length, 0);
});

test("route POST: a real entry flows through and dedupes", async () => {
  const res = await route.POST(
    fakeRequest({ name: "Pat", email: "pat@example.com", businessName: "Pat's Bakery" })
  );
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const res2 = await route.POST(
    fakeRequest({ name: "Pat", email: "pat@example.com", businessName: "Pat's Bakery" })
  );
  const payload2 = await res2.json();
  assert.equal(payload2.reused, true);
  const leads = (await store.listLeads()).filter((l) => l.email === "pat@example.com");
  assert.equal(leads.length, 1);
});

test("route POST: missing business name is a 400 with a plain error", async () => {
  const res = await route.POST(fakeRequest({ name: "Pat", email: "pat@example.com" }));
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.ok, false);
  assert.match(payload.error, /business name/);
});
