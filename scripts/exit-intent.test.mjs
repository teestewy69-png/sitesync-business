// Exit-intent capture: pure decision logic in lib/exit-intent.ts (no DOM, no network).
//   node --test scripts/exit-intent.test.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const {
  DWELL_THRESHOLD_MS,
  SUPPRESSION_WINDOW_MS,
  SEEN_STORAGE_KEY,
  hasSeenRecently,
  isExcludedPath,
  isExitScrollBurst,
  shouldArm,
} = await import("../lib/exit-intent.ts");

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-08T12:00:00.000Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * DAY).toISOString();

test("constants are the documented values", () => {
  assert.equal(DWELL_THRESHOLD_MS, 8_000);
  assert.equal(SUPPRESSION_WINDOW_MS, 30 * DAY);
  assert.equal(SEEN_STORAGE_KEY, "sitesinc-exit-capture-seen");
});

test("excluded paths: commerce, factory, api, and the audit page itself", () => {
  for (const path of [
    "/store",
    "/store/",
    "/store/some-product",
    "/cart",
    "/cart/review",
    "/checkout",
    "/checkout/confirm",
    "/app",
    "/app/clients",
    "/app/website-data",
    "/api",
    "/api/subscribe",
    "/free-website-audit",
  ]) {
    assert.equal(isExcludedPath(path), true, path);
  }
});

test("marketing paths are allowed, including lookalike prefixes", () => {
  for (const path of [
    "/",
    "/contact",
    "/pricing",
    "/locations/walnut",
    "/storefront",
    "/apple-services",
    "/carts",
  ]) {
    assert.equal(isExcludedPath(path), false, path);
  }
});

test("shouldArm enforces the dwell gate, the seen flag, and exclusions", () => {
  assert.equal(shouldArm({ pathname: "/", dwellMs: 7_999, alreadySeen: false }), false);
  assert.equal(shouldArm({ pathname: "/", dwellMs: 8_000, alreadySeen: false }), true);
  assert.equal(shouldArm({ pathname: "/", dwellMs: 60_000, alreadySeen: true }), false);
  assert.equal(shouldArm({ pathname: "/checkout", dwellMs: 60_000, alreadySeen: false }), false);
  assert.equal(shouldArm({ pathname: "/app", dwellMs: 60_000, alreadySeen: false }), false);
});

test("30-day suppression window edges", () => {
  assert.equal(hasSeenRecently(daysAgo(0), NOW), true);
  assert.equal(hasSeenRecently(daysAgo(29), NOW), true);
  assert.equal(hasSeenRecently(daysAgo(30), NOW), false);
  assert.equal(hasSeenRecently(daysAgo(31), NOW), false);
  assert.equal(hasSeenRecently(daysAgo(90), NOW), false);
});

test("missing, malformed, or future timestamps never suppress", () => {
  assert.equal(hasSeenRecently(null, NOW), false);
  assert.equal(hasSeenRecently(undefined, NOW), false);
  assert.equal(hasSeenRecently("", NOW), false);
  assert.equal(hasSeenRecently("not-a-date", NOW), false);
  assert.equal(hasSeenRecently(new Date(NOW.getTime() + DAY).toISOString(), NOW), false);
});

test("scroll burst: needs the deep scroll first, then a fast long upward burst", () => {
  // Never scrolled past the minimum depth: no burst no matter how fast.
  assert.equal(
    isExitScrollBurst({ maxScrollY: 599, fromY: 599, toY: 100, elapsedMs: 100 }),
    false
  );
  // Textbook burst: 400px up in 200ms after scrolling 1,200px down.
  assert.equal(
    isExitScrollBurst({ maxScrollY: 1_200, fromY: 1_200, toY: 800, elapsedMs: 200 }),
    true
  );
  // Too short a distance.
  assert.equal(
    isExitScrollBurst({ maxScrollY: 1_200, fromY: 1_200, toY: 900, elapsedMs: 200 }),
    false
  );
  // Too slow.
  assert.equal(
    isExitScrollBurst({ maxScrollY: 1_200, fromY: 1_200, toY: 800, elapsedMs: 301 }),
    false
  );
  // Downward or stationary movement is never a burst.
  assert.equal(
    isExitScrollBurst({ maxScrollY: 1_200, fromY: 800, toY: 1_200, elapsedMs: 100 }),
    false
  );
  assert.equal(
    isExitScrollBurst({ maxScrollY: 1_200, fromY: 900, toY: 900, elapsedMs: 100 }),
    false
  );
  // Edges: exactly at the distance and window limits fires.
  assert.equal(
    isExitScrollBurst({ maxScrollY: 600, fromY: 600, toY: 250, elapsedMs: 300 }),
    true
  );
});
