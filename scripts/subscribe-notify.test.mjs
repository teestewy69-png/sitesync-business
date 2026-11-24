// Subscribe email flow: the form must answer as soon as the lead is saved,
// and the confirmation email must send exactly once, in its own request.
// Proven live 2026-11-23: awaiting the sends held the form ~10s; Next
// `after` did not release the response early on Netlify; a background-route
// handoff plus an in-request fallback raced and sent a duplicate. The
// wiring below is the fix — keep it intact.
//   node --test scripts/subscribe-notify.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const subscribeRoute = readFileSync("app/api/subscribe/route.ts", "utf8");
const notifyRoute = readFileSync("app/api/subscribe/notify/route.ts", "utf8");
const backgroundRoute = readFileSync(
  "app/api/subscribe/notify-background/route.ts",
  "utf8"
);
const subscribeMail = readFileSync("lib/subscribe-mail.ts", "utf8");
const emailCapture = readFileSync("components/EmailCapture.tsx", "utf8");
const exitIntent = readFileSync("components/ExitIntentCapture.tsx", "utf8");

test("subscribe route does no mail work and no handoffs", () => {
  assert.doesNotMatch(subscribeRoute, /sendMail|sendSubscribeEmails/);
  assert.doesNotMatch(subscribeRoute, /notify-background/);
  assert.doesNotMatch(subscribeRoute, /\bafter\(/);
});

test("both capture forms fire the notify call after a successful save", () => {
  for (const form of [emailCapture, exitIntent]) {
    assert.match(form, /fetch\("\/api\/subscribe\/notify"/);
    assert.match(form, /keepalive: true/);
    assert.match(form, /leadId: data\.id/);
  }
});

test("notify route only acts on a fresh, unsent, real lead", () => {
  assert.match(notifyRoute, /leadId\.startsWith\("lead_"\)/);
  assert.match(notifyRoute, /findLeadById\(leadId\)/);
  assert.match(notifyRoute, /notificationState === "sent" \|\| lead\.notificationState === "sending"/);
  assert.match(notifyRoute, /15 \* 60 \* 1000/);
  assert.match(notifyRoute, /sendSubscribeEmails\(leadId\)/);
});

test("shared sender claims the lead before sending (no duplicates)", () => {
  const claimAt = subscribeMail.indexOf('notificationState: "sending"');
  const sendAt = subscribeMail.indexOf("await sendMail(");
  assert.ok(claimAt > -1, "claim write exists");
  assert.ok(sendAt > claimAt, "claim happens before the first send");
  assert.match(subscribeMail, /notificationState: mailed\.sent/);
});

test("the retired background route is a tombstone that sends nothing", () => {
  assert.match(backgroundRoute, /status: 410/);
  assert.doesNotMatch(backgroundRoute, /sendSubscribeEmails\(leadId\)/);
});
