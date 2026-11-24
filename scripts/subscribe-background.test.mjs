// Subscribe email handoff: the form must answer as soon as the lead is saved.
// The sends live behind the Netlify background notify route; the subscribe
// route only falls back to an in-request send when the handoff fails.
// (Next `after` alone did not release the response early on Netlify —
// proven live 2026-11-23 — so this wiring is the fix; keep it intact.)
//   node --test scripts/subscribe-background.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const subscribeRoute = readFileSync("app/api/subscribe/route.ts", "utf8");
const backgroundRoute = readFileSync(
  "app/api/subscribe/notify-background/route.ts",
  "utf8"
);
const subscribeMail = readFileSync("lib/subscribe-mail.ts", "utf8");

test("subscribe route hands the emails to the background notify route", () => {
  assert.match(subscribeRoute, /\/api\/subscribe\/notify-background/);
  assert.match(subscribeRoute, /handedOff = handoff\.status === 202/);
  assert.match(subscribeRoute, /x-subscribe-secret/);
});

test("subscribe route keeps an in-request fallback when the handoff fails", () => {
  assert.match(subscribeRoute, /if \(!handedOff\) \{\s*after\(\(\) => sendSubscribeEmails\(lead\.id\)\);/);
});

test("subscribe route no longer sends mail inline before answering", () => {
  assert.doesNotMatch(subscribeRoute, /from "@\/lib\/mail"/);
  assert.doesNotMatch(subscribeRoute, /await sendMail\(/);
});

test("background route is secret-gated and lead-scoped", () => {
  assert.match(backgroundRoute, /SUBSCRIBE_NOTIFY_SECRET/);
  assert.match(backgroundRoute, /x-subscribe-secret/);
  assert.match(backgroundRoute, /leadId\.startsWith\("lead_"\)/);
  assert.match(backgroundRoute, /findLeadById\(leadId\)/);
});

test("shared sender is idempotent and records the real outcome", () => {
  assert.match(subscribeMail, /lead\.notificationState === "sent"/);
  assert.match(subscribeMail, /notificationState: mailed\.sent/);
  assert.match(subscribeMail, /"Your Sitesinc website request"/);
});
