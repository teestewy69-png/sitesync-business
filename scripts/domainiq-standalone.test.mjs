// Standalone DomainIQ page (Tony, 2026-11-09: "build a stand alone").
// The generator must exist as its own factory route, be reachable from the
// rail, use the existing ad-hoc generate + single-score APIs, and save runs
// so a refresh does not wipe them (the old bay's try-form saved nothing).
//   node --test scripts/domainiq-standalone.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

test("standalone DomainIQ route exists inside the factory shell", () => {
  const pagePath = path.join(ROOT, "app/app/domainiq/page.tsx");
  assert.ok(existsSync(pagePath), "app/app/domainiq/page.tsx must exist");
  const page = read("app/app/domainiq/page.tsx");
  assert.match(page, /FactoryShell/);
  assert.match(page, /DomainIQStandalone/);
  assert.match(page, /summarizeDomainBay/);
  assert.match(page, /availabilityCheckingEnabled/);
});

test("factory rail links DomainIQ to its own page, not a home-page anchor", () => {
  const rail = read("components/factory/FactoryRail.tsx");
  assert.match(rail, /href: "\/app\/domainiq", label: "DomainIQ"/);
  assert.doesNotMatch(rail, /\/app#domainiq-bay/);
});

test("factory home bay points at the standalone generator", () => {
  const bay = read("components/factory/DomainIQBay.tsx");
  assert.match(bay, /href="\/app\/domainiq"/);
  assert.match(bay, /standalone generator/);
});

test("standalone generator drives the existing DomainIQ APIs", () => {
  const ui = read("components/factory/DomainIQStandalone.tsx");
  assert.match(ui, /\/api\/factory\/domainiq\/generate/);
  assert.match(ui, /\/api\/factory\/domainiq\/availability/);
  assert.match(ui, /\/api\/factory\/domainiq\/score/);
  // Ad-hoc generate must not pretend to be saved server-side: no projectId is sent.
  assert.doesNotMatch(ui, /projectId/);
});

test("standalone generator saves runs in the browser and can restore them", () => {
  const ui = read("components/factory/DomainIQStandalone.tsx");
  assert.match(ui, /localStorage/);
  assert.match(ui, /sitesinc-domainiq-runs-v1/);
  assert.match(ui, /Saved runs/);
  assert.match(ui, /restoreRun/);
});

test("standalone generator is honest about purchase and availability", () => {
  const ui = read("components/factory/DomainIQStandalone.tsx");
  assert.match(ui, /never buys a domain/);
  assert.match(ui, /Top verified-available pick/);
  assert.match(ui, /availability not verified/i);
  assert.match(ui, /Download CSV/);
});

test("standalone page sits behind the factory auth gate", () => {
  const middleware = read("middleware.ts");
  // Every /app/* path goes through factoryAuth; the new route is an /app/* path.
  assert.match(middleware, /pathname\.startsWith\("\/app\/"\)/);
  assert.match(middleware, /factoryAuth\(req\)/);
});
