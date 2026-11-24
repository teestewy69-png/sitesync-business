// Free audit by email (founder ruling 2026-11-23): the audit is NOT run on
// the spot. The capture route saves the lead and answers at once; the form
// fires the /send call so the deep audit and the results email run in their
// own invocation; the shared sender claims the lead before working so no
// duplicate email can go out. The wiring below is the contract — keep it
// intact.
//   node --test scripts/free-audit-email.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requestRoute = readFileSync("app/api/free-website-audit/request/route.ts", "utf8");
const sendRoute = readFileSync("app/api/free-website-audit/send/route.ts", "utf8");
const auditMail = readFileSync("lib/audit-mail.ts", "utf8");
const form = readFileSync("components/AuditCaptureForm.tsx", "utf8");
const page = readFileSync("app/free-website-audit/page.tsx", "utf8");
const banner = readFileSync("components/PilotOffer.tsx", "utf8");
const inbox = readFileSync("app/app/inbox/page.tsx", "utf8");

test("request route saves a free-audit lead and does no audit or mail work", () => {
  assert.match(requestRoute, /FREE_AUDIT_SOURCE/);
  assert.match(requestRoute, /appendLead/);
  assert.doesNotMatch(requestRoute, /sendMail|deepAuditUrl|sendAuditEmail/);
});

test("the form fires the send call after a successful save", () => {
  assert.match(form, /fetch\("\/api\/free-website-audit\/request"/);
  assert.match(form, /fetch\("\/api\/free-website-audit\/send"/);
  assert.match(form, /keepalive: true/);
  assert.match(form, /leadId: data\.id/);
});

test("send route only acts on a fresh, unsent, real free-audit lead", () => {
  assert.match(sendRoute, /leadId\.startsWith\("lead_"\)/);
  assert.match(sendRoute, /findLeadById\(leadId\)/);
  assert.match(sendRoute, /lead\.source !== FREE_AUDIT_SOURCE/);
  assert.match(sendRoute, /notificationState === "sent" \|\| lead\.notificationState === "sending"/);
  assert.match(sendRoute, /60 \* 60 \* 1000/);
});

test("sender claims the lead before auditing and includes the free ebook", () => {
  assert.match(auditMail, /notificationState: "sending"/);
  assert.match(auditMail, /deepAuditUrl\(site\)/);
  assert.match(auditMail, /what-your-web-builder-wont-tell-you\.pdf/);
  assert.match(auditMail, /FREE_AUDIT_SOURCE = "free-audit"/);
});

test("the audit page uses the capture form, not the instant form", () => {
  assert.match(page, /AuditCaptureForm/);
  assert.doesNotMatch(page, /<AuditForm/);
  assert.doesNotMatch(page, /No email needed/);
});

test("banner and inbox carry the new flow", () => {
  assert.match(banner, /email you the results/);
  assert.doesNotMatch(banner, /runs on the spot/);
  assert.match(inbox, /FREE_AUDIT_SOURCE/);
});
