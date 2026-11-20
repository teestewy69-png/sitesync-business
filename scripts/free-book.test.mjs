// Free-ebook lead magnets: /free-book capture for "What Your Web Builder
// Won't Tell You" (SitesInc) and the cross-origin /api/flipradar-book capture
// for "Your First Flip" (FlipRadar). Covers the guide content (Gate-2 clean),
// signup dedupe-by-email per source against the local JSON store in a temp
// dir, both welcome emails, and both routes (honeypot, happy path, CORS).
// No network, no SMTP (env cleared on purpose: mail reports "not_configured"
// and the saved lead stays the source of truth).
//   node --test scripts/free-book.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { mkdtempSync, rmSync, readFileSync, existsSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Isolate every store write (lib/persistence.ts resolves data/ from cwd at import time).
const REPO_CWD = process.cwd();
const TMP = mkdtempSync(path.join(tmpdir(), "free-book-test-"));
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.TITAN_SMTP_USER;
delete process.env.TITAN_SMTP_PASS;
delete process.env.ZOHO_SMTP_USER;
delete process.env.ZOHO_SMTP_PASS;
delete process.env.DEPLOY_PRIME_URL;
delete process.env.URL;
delete process.env.NEXT_PUBLIC_SITE_URL;
process.env.SITESINC_STORE = "local";
process.chdir(TMP);

const book = await import("../lib/free-book.ts");
const mail = await import("../lib/mail.ts");
const store = await import("../lib/store.ts");
const { PUBLIC_PATHS } = await import("../lib/factory/pipeline.ts");
const freeBookRoute = await import("../app/api/free-book/route.ts");
const flipRadarRoute = await import("../app/api/flipradar-book/route.ts");

test.after(() => {
  process.chdir(REPO_CWD);
  rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------- content ------------------------------- */

test("guide content: full 7-chapter structure with real substance", () => {
  assert.equal(book.GUIDE.title, "What Your Web Builder Won't Tell You");
  assert.equal(book.FREE_BOOK_SOURCE, "lead-magnet-free-book");
  assert.equal(book.FLIPRADAR_BOOK_SOURCE, "lead-magnet-flipradar");
  assert.equal(book.GUIDE.chapters.length, 7);
  let tables = 0;
  let checklists = 0;
  for (const chapter of book.GUIDE.chapters) {
    assert.ok(chapter.heading.startsWith("Chapter "), chapter.heading);
    assert.ok(chapter.blocks.length >= 3, `${chapter.heading}: thin chapter`);
    for (const block of chapter.blocks) {
      if (block.type === "table") {
        tables += 1;
        assert.ok(block.head.length >= 2 && block.rows.length >= 3, `${chapter.heading}: thin table`);
      }
      if (block.type === "checklist") {
        checklists += 1;
        assert.ok(block.items.length >= 3, `${chapter.heading}: thin checklist`);
      }
      if (block.type === "p") assert.ok(block.text.length > 10, `${chapter.heading}: empty paragraph`);
    }
  }
  assert.ok(tables >= 4, "fee stack, worksheet, and comparison tables present");
  assert.ok(checklists >= 4, "chapter 7 checklist groups present");
  const text = book.guideText();
  assert.ok(text.includes("$7,915"), "worked comparison totals survive to plain text");
  assert.ok(text.includes("[ ]"), "plain-text copy carries checkbox items");
  assert.ok(!text.includes("**"), "plain-text copy strips inline markers");
});

test("guide content: Gate-2 clean — no income promises, honest costs stated", () => {
  const all = JSON.stringify(book.GUIDE).toLowerCase();
  for (const banned of ["passive income", "get rich", "make money fast", "six figures", "guaranteed income", "risk-free", "risk free"]) {
    assert.ok(!all.includes(banned), `guide must not contain "${banned}"`);
  }
  // The guide's honesty anchors must be present: ranking promises debunked,
  // domain renewal charged to everyone (SitesInc clients included).
  assert.ok(all.includes("nobody can guarantee a #1 ranking"));
  assert.ok(all.includes("no matter who builds your site"));
  assert.ok(all.includes("$1,995"));
});

test("assets: the welcome-email PDF exists in public/ and is a real PDF", () => {
  const pdfPath = path.join(ROOT, "public", "what-your-web-builder-wont-tell-you.pdf");
  assert.ok(existsSync(pdfPath), "PDF missing — build it with the guide-library PDF pipeline");
  const head = readFileSync(pdfPath).subarray(0, 5).toString("latin1");
  assert.equal(head, "%PDF-");
  assert.equal(book.FREE_BOOK_PDF_PATH, "/what-your-web-builder-wont-tell-you.pdf");
  assert.equal(book.FREE_BOOK_PAGE_PATH, "/free-book/guide");
});

test("routing: /free-book is a public path (sitemap), the guide page itself stays out", () => {
  assert.ok(PUBLIC_PATHS.includes("/free-book"));
  assert.ok(!PUBLIC_PATHS.includes("/free-book/guide"));
});

/* ----------------------------- welcome emails ----------------------------- */

test("freeBookWelcomeEmail: delivers both ebook links and the soft SitesInc line", () => {
  const mail = book.freeBookWelcomeEmail("Jo", "https://sitesinc.co");
  assert.equal(mail.subject, "Your free ebook: What Your Web Builder Won't Tell You");
  assert.ok(mail.text.startsWith("Hi Jo,"));
  assert.ok(mail.text.includes("https://sitesinc.co/free-book/guide"));
  assert.ok(mail.text.includes("https://sitesinc.co/what-your-web-builder-wont-tell-you.pdf"));
  assert.ok(mail.text.includes("$1,995 flat, one time, no subscriptions"));
  assert.ok(mail.text.includes("save@sitesinc.co"));
  assert.ok(mail.text.includes("1968 South Coast Hwy #3632, Laguna Beach, CA 92651"));
});

test("flipRadarWelcomeEmail: purely FlipRadar — book URL on flipradar.co, no SitesInc links", () => {
  const mail = book.flipRadarWelcomeEmail("Jo");
  assert.equal(mail.subject, "Your free ebook: Your First Flip");
  assert.ok(mail.text.startsWith("Hi Jo,"));
  assert.ok(mail.text.includes("https://flipradar.co/your-first-flip-guide.pdf"));
  assert.ok(mail.text.includes("hello@flipradar.co"), "FlipRadar's own contact address is in the sign-off");
  assert.equal(book.FLIPRADAR_CONTACT_EMAIL, "hello@flipradar.co");
  assert.ok(!mail.text.toLowerCase().includes("sitesinc"), "FlipRadar email must not mention SitesInc");
  assert.ok(!mail.text.includes("sitesinc.co"), "FlipRadar email must not link sitesinc.co");
});

/* ---------------------------- signup flow (store) ---------------------------- */

test("handleFreeBookSignup: invalid body -> 400 and nothing is stored", async () => {
  const result = await book.handleFreeBookSignup({ name: "", email: "nope" });
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  const leads = (await store.listLeads()).filter((l) => l.source === book.FREE_BOOK_SOURCE);
  assert.equal(leads.length, 0);
});

test("handleFreeBookSignup: saves one lead tagged lead-magnet-free-book with the business kind", async () => {
  const result = await book.handleFreeBookSignup(
    { name: "Jo", email: "Jo@Example.com", businessKind: "Dog grooming" },
    "https://sitesinc.co"
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.source === book.FREE_BOOK_SOURCE);
  assert.equal(leads.length, 1);
  const lead = leads[0];
  assert.equal(lead.name, "Jo");
  assert.equal(lead.email, "jo@example.com");
  assert.equal(lead.details, "Starting: Dog grooming");
  assert.equal(lead.notificationState, "not_configured");
  assert.equal(result.body.warning !== undefined, true);
});

test("handleFreeBookSignup: same email twice = one entry, refreshed, original date kept", async () => {
  const before = (await store.listLeads()).find((l) => l.source === book.FREE_BOOK_SOURCE);
  const result = await book.handleFreeBookSignup(
    { name: "Joanna", email: "jo@example.com", businessKind: "Mobile dog grooming" },
    "https://sitesinc.co"
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.reused, true);
  const leads = (await store.listLeads()).filter((l) => l.source === book.FREE_BOOK_SOURCE);
  assert.equal(leads.length, 1, "duplicate signup must not create a second lead");
  assert.equal(leads[0].id, before.id);
  assert.equal(leads[0].name, "Joanna");
  assert.equal(leads[0].createdAt, before.createdAt);
});

test("zoho profile: unconfigured Zoho reports not-sent gracefully, never throws", async () => {
  assert.equal(mail.isFlipRadarMailConfigured(), false);
  const sent = await mail.sendFlipRadarMail({
    to: "someone@example.com",
    subject: "Your free ebook: Your First Flip",
    text: "test",
  });
  assert.deepEqual(sent, { sent: false });
});

test("handleFlipRadarSignup: same email under the FlipRadar source is its own lead", async () => {
  const result = await book.handleFlipRadarSignup({ name: "Jo", email: "jo@example.com" });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  const flipLeads = (await store.listLeads()).filter((l) => l.source === book.FLIPRADAR_BOOK_SOURCE);
  assert.equal(flipLeads.length, 1);
  assert.equal(flipLeads[0].email, "jo@example.com");
  // No Zoho credentials in the test env: lead saved, welcome email not_configured.
  assert.equal(flipLeads[0].notificationState, "not_configured");
  assert.equal(result.body.warning !== undefined, true);
  const bookLeads = (await store.listLeads()).filter((l) => l.source === book.FREE_BOOK_SOURCE);
  assert.equal(bookLeads.length, 1, "the SitesInc lead is untouched");
  assert.notEqual(flipLeads[0].id, bookLeads[0].id, "each source keeps its own lead record");
});

test("handleFlipRadarSignup: dedupes within its own source", async () => {
  const result = await book.handleFlipRadarSignup({ name: "Jo", email: "jo@example.com" });
  assert.equal(result.body.reused, true);
  const flipLeads = (await store.listLeads()).filter((l) => l.source === book.FLIPRADAR_BOOK_SOURCE);
  assert.equal(flipLeads.length, 1);
});

/* --------------------------------- routes --------------------------------- */

function fakeRequest(body, extraHeaders = {}) {
  return {
    headers: new Headers({
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.9",
      ...extraHeaders,
    }),
    nextUrl: { origin: "https://sitesinc.co" },
    json: async () => body,
    formData: async () => new FormData(),
  };
}

test("free-book route POST: honeypot submissions are dropped silently", async () => {
  const res = await freeBookRoute.POST(
    fakeRequest({ name: "Bot", email: "bot@example.com", company_website: "http://spam" })
  );
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.email === "bot@example.com");
  assert.equal(leads.length, 0);
});

test("free-book route POST: a real signup flows through and dedupes", async () => {
  const res = await freeBookRoute.POST(
    fakeRequest({ name: "Pat", email: "pat@example.com", businessKind: "Bakery" })
  );
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const res2 = await freeBookRoute.POST(fakeRequest({ name: "Pat", email: "pat@example.com" }));
  const payload2 = await res2.json();
  assert.equal(payload2.reused, true);
  const leads = (await store.listLeads()).filter(
    (l) => l.email === "pat@example.com" && l.source === book.FREE_BOOK_SOURCE
  );
  assert.equal(leads.length, 1);
});

test("flipradar route OPTIONS: preflight grants only the FlipRadar origins", async () => {
  const okRes = await flipRadarRoute.OPTIONS(fakeRequest({}, { origin: "https://flipradar.co" }));
  assert.equal(okRes.status, 204);
  assert.equal(okRes.headers.get("access-control-allow-origin"), "https://flipradar.co");
  assert.match(okRes.headers.get("access-control-allow-methods") || "", /POST/);
  const badRes = await flipRadarRoute.OPTIONS(
    fakeRequest({}, { origin: "https://evil.example.com" })
  );
  assert.equal(badRes.headers.get("access-control-allow-origin"), null);
});

test("flipradar route POST: cross-origin signup stores a lead-magnet-flipradar lead", async () => {
  const res = await flipRadarRoute.POST(
    fakeRequest(
      { name: "Flip", email: "flip@example.com", businessKind: "First flip" },
      { origin: "https://flipradar.co" }
    )
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://flipradar.co");
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const leads = (await store.listLeads()).filter(
    (l) => l.email === "flip@example.com" && l.source === book.FLIPRADAR_BOOK_SOURCE
  );
  assert.equal(leads.length, 1);
  assert.equal(leads[0].details, "Starting: First flip");
});

test("flipradar route POST: invalid email is a 400 with a plain error", async () => {
  const res = await flipRadarRoute.POST(
    fakeRequest({ name: "Flip", email: "nope" }, { origin: "https://flipradar.co" })
  );
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.ok, false);
  assert.match(payload.error, /valid email/);
});
