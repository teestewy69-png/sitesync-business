// Lead magnet: /start capture for "The New Business Website Starter Checklist".
// Covers the checklist content (Gate-2 clean), signup validation, the real
// dedupe-by-email signup flow against the local JSON store in a temp dir,
// the welcome email copy, the factory CSV export shape, and the /api/lead-magnet
// route (honeypot + happy path). No network, no SMTP (env cleared on purpose:
// mail reports "not_configured" and the saved lead stays the source of truth).
//   node --test scripts/lead-magnet.test.mjs     (Node >= 22.18 for TypeScript type stripping)
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
const TMP = mkdtempSync(path.join(tmpdir(), "lead-magnet-test-"));
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.TITAN_SMTP_USER;
delete process.env.TITAN_SMTP_PASS;
delete process.env.DEPLOY_PRIME_URL;
delete process.env.URL;
delete process.env.NEXT_PUBLIC_SITE_URL;
process.env.SITESINC_STORE = "local";
process.chdir(TMP);

const magnet = await import("../lib/lead-magnet.ts");
const store = await import("../lib/store.ts");
const { PUBLIC_PATHS } = await import("../lib/factory/pipeline.ts");
const route = await import("../app/api/lead-magnet/route.ts");

test.after(() => {
  process.chdir(REPO_CWD);
  rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------- content ------------------------------- */

test("checklist content: full structure, genuinely checkable items", () => {
  assert.equal(magnet.CHECKLIST.title, "The New Business Website Starter Checklist");
  assert.equal(magnet.LEAD_MAGNET_SOURCE, "lead-magnet-start");
  assert.equal(magnet.CHECKLIST.sections.length, 6);
  for (const section of magnet.CHECKLIST.sections) {
    assert.ok(section.heading.trim().length > 0, "section heading missing");
    assert.ok(section.items.length >= 4, `${section.heading}: needs at least 4 items`);
    for (const item of section.items) {
      assert.ok(typeof item === "string" && item.trim().length > 20, `${section.heading}: thin item`);
    }
  }
  const text = magnet.checklistText();
  assert.ok(text.includes(magnet.CHECKLIST.title));
  assert.ok(text.includes("[ ]"), "plain-text copy carries checkbox items");
});

test("checklist content: Gate-2 clean — no income promises, no hype claims", () => {
  const all = JSON.stringify(magnet.CHECKLIST).toLowerCase();
  for (const banned of ["guarantee", "passive income", "get rich", "make money fast", "six figures", "#1", "best in"]) {
    assert.ok(!all.includes(banned), `checklist must not contain "${banned}"`);
  }
});

test("assets: the welcome-email PDF exists in public/ and is a real PDF", () => {
  const pdfPath = path.join(ROOT, "public", "new-business-website-starter-checklist.pdf");
  assert.ok(existsSync(pdfPath), "PDF missing — run node scripts/build-lead-magnet-pdf.mjs");
  const head = readFileSync(pdfPath).subarray(0, 5).toString("latin1");
  assert.equal(head, "%PDF-");
  assert.equal(magnet.CHECKLIST_PDF_PATH, "/new-business-website-starter-checklist.pdf");
  assert.equal(magnet.CHECKLIST_PAGE_PATH, "/start/checklist");
});

test("routing: /start is a public path (sitemap), the checklist page itself stays out", () => {
  assert.ok(PUBLIC_PATHS.includes("/start"));
  assert.ok(!PUBLIC_PATHS.includes("/start/checklist"));
});

/* ------------------------------ validation ------------------------------ */

test("parseLeadMagnetSignup: trims name, lowercases email, keeps the business kind", () => {
  const parsed = magnet.parseLeadMagnetSignup({
    name: "  Jo  ",
    email: "  Jo@Example.COM ",
    businessKind: " Dog grooming ",
  });
  assert.deepEqual(parsed, {
    ok: true,
    signup: { name: "Jo", email: "jo@example.com", businessKind: "Dog grooming" },
  });
});

test("parseLeadMagnetSignup: business kind is optional", () => {
  const parsed = magnet.parseLeadMagnetSignup({ name: "Jo", email: "jo@example.com" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.signup.businessKind, undefined);
});

test("parseLeadMagnetSignup: rejects missing name and bad emails", () => {
  assert.equal(magnet.parseLeadMagnetSignup({ email: "jo@example.com" }).ok, false);
  assert.equal(magnet.parseLeadMagnetSignup({ name: "Jo", email: "not-an-email" }).ok, false);
  assert.equal(magnet.parseLeadMagnetSignup({ name: "Jo", email: "" }).ok, false);
  assert.equal(magnet.parseLeadMagnetSignup({ name: "Jo", email: "a@b" }).ok, false);
});

/* ----------------------------- welcome email ----------------------------- */

test("welcomeEmail: delivers both checklist links and the soft SitesInc line", () => {
  const mail = magnet.welcomeEmail("Jo", "https://sitesinc.co");
  assert.equal(mail.subject, "Your New Business Website Starter Checklist");
  assert.ok(mail.text.startsWith("Hi Jo,"));
  assert.ok(mail.text.includes("https://sitesinc.co/start/checklist"));
  assert.ok(mail.text.includes("https://sitesinc.co/new-business-website-starter-checklist.pdf"));
  assert.ok(mail.text.includes("$1,995 flat, one time, no subscriptions"));
  assert.ok(mail.text.includes("save@sitesinc.co"));
  assert.ok(mail.text.includes("1968 South Coast Hwy #3632, Laguna Beach, CA 92651"));
});

/* --------------------------- signup flow (store) --------------------------- */

test("handleLeadMagnetSignup: invalid body -> 400 and nothing is stored", async () => {
  const result = await magnet.handleLeadMagnetSignup({ name: "", email: "nope" });
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  const leads = (await store.listLeads()).filter((l) => l.source === magnet.LEAD_MAGNET_SOURCE);
  assert.equal(leads.length, 0);
});

test("handleLeadMagnetSignup: saves one lead tagged lead-magnet-start with the business kind", async () => {
  const result = await magnet.handleLeadMagnetSignup(
    { name: "Jo", email: "Jo@Example.com", businessKind: "Dog grooming" },
    "https://sitesinc.co"
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.source === magnet.LEAD_MAGNET_SOURCE);
  assert.equal(leads.length, 1);
  const lead = leads[0];
  assert.equal(lead.name, "Jo");
  assert.equal(lead.email, "jo@example.com");
  assert.equal(lead.details, "Starting: Dog grooming");
  assert.ok(lead.createdAt, "timestamp kept");
  // No SMTP in the test env: the lead records that the email could not configure-send.
  assert.equal(lead.notificationState, "not_configured");
  assert.equal(result.body.warning !== undefined, true);
});

test("handleLeadMagnetSignup: same email twice = one entry, refreshed, original date kept", async () => {
  const before = (await store.listLeads()).find((l) => l.source === magnet.LEAD_MAGNET_SOURCE);
  const result = await magnet.handleLeadMagnetSignup(
    { name: "Joanna", email: "jo@example.com", businessKind: "Mobile dog grooming" },
    "https://sitesinc.co"
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.reused, true);
  const leads = (await store.listLeads()).filter((l) => l.source === magnet.LEAD_MAGNET_SOURCE);
  assert.equal(leads.length, 1, "duplicate signup must not create a second lead");
  assert.equal(leads[0].id, before.id);
  assert.equal(leads[0].name, "Joanna");
  assert.equal(leads[0].details, "Starting: Mobile dog grooming");
  assert.equal(leads[0].createdAt, before.createdAt);
});

test("handleLeadMagnetSignup: a different email is a different subscriber", async () => {
  const result = await magnet.handleLeadMagnetSignup({ name: "Sam", email: "sam@example.com" });
  assert.equal(result.body.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.source === magnet.LEAD_MAGNET_SOURCE);
  assert.equal(leads.length, 2);
});

/* --------------------------------- CSV --------------------------------- */

test("leadsToCsv: header, business-kind extraction, and RFC-4180 quoting", () => {
  const csv = magnet.leadsToCsv([
    {
      id: "lead_x",
      name: 'Jo "The Groomer", Jr.',
      email: "jo@example.com",
      source: "lead-magnet-start",
      createdAt: "2026-11-13T00:00:00.000Z",
      details: "Starting: Dog grooming",
      notificationState: "sent",
    },
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "created_at,first_name,email,source,business_kind,lead_id,email_state");
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('"Jo ""The Groomer"", Jr."'), "name with quotes/commas is quoted");
  assert.ok(lines[1].includes("Dog grooming"));
  assert.ok(lines[1].endsWith("sent"));
});

/* --------------------------------- route --------------------------------- */

function fakeRequest(body) {
  return {
    headers: new Headers({ "content-type": "application/json", "x-forwarded-for": "203.0.113.9" }),
    nextUrl: { origin: "https://sitesinc.co" },
    json: async () => body,
    formData: async () => new FormData(),
  };
}

test("route POST: honeypot submissions are dropped silently (ok, nothing stored)", async () => {
  const res = await route.POST(fakeRequest({ name: "Bot", email: "bot@example.com", company_website: "http://spam" }));
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const leads = (await store.listLeads()).filter((l) => l.email === "bot@example.com");
  assert.equal(leads.length, 0);
});

test("route POST: a real signup flows through and dedupes", async () => {
  const res = await route.POST(fakeRequest({ name: "Pat", email: "pat@example.com", businessKind: "Bakery" }));
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.ok, true);
  const res2 = await route.POST(fakeRequest({ name: "Pat", email: "pat@example.com" }));
  const payload2 = await res2.json();
  assert.equal(payload2.reused, true);
  const leads = (await store.listLeads()).filter((l) => l.email === "pat@example.com");
  assert.equal(leads.length, 1);
});

test("route POST: invalid email is a 400 with a plain error", async () => {
  const res = await route.POST(fakeRequest({ name: "Pat", email: "nope" }));
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.ok, false);
  assert.match(payload.error, /valid email/);
});
