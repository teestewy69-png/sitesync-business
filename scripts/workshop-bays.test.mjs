// Workshop bays Tony named: DomainIQ, SiteGrow, ScaleQuan must be wired in factory nav + home.
//   node --test scripts/workshop-bays.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("factory shell exposes SiteGrow, DomainIQ, and ScaleQuan tabs", () => {
  const shell = readFileSync(path.join(ROOT, "components/factory/Shell.tsx"), "utf8");
  assert.match(shell, /href: "\/app\/clients".*SiteGrow/s);
  assert.match(shell, /DomainIQ/);
  assert.match(shell, /ScaleQuan/);
});

test("factory home mounts all three bays", () => {
  const home = readFileSync(path.join(ROOT, "app/app/page.tsx"), "utf8");
  assert.match(home, /SiteGrowBay/);
  assert.match(home, /DomainIQBay/);
  assert.match(home, /CityLaunchBay/);
  assert.match(home, /queue-sitesinc-cities/);
  assert.match(home, /domainiq-backfill/);
});

test("DomainIQ bay exposes Fire up for every client that still needs candidates", () => {
  const bay = readFileSync(path.join(ROOT, "components/factory/DomainIQBay.tsx"), "utf8");
  assert.match(bay, /Fire up DomainIQ/);
  assert.match(bay, /domainiq-backfill/);
  assert.match(bay, /Factory only/);
  const record = readFileSync(path.join(ROOT, "lib/factory/sitesinc-city.ts"), "utf8");
  assert.match(record, /ownedDomain: "sitesinc\.co"/);
  assert.match(record, /domainStatus: "client_owned"/);
});

test("DomainIQ stays in the factory — not public nav, sitemap, or site copy", () => {
  const nav = readFileSync(path.join(ROOT, "lib/site-nav.ts"), "utf8");
  const content = readFileSync(path.join(ROOT, "content.json"), "utf8");
  const sitemap = readFileSync(path.join(ROOT, "app/sitemap.ts"), "utf8");
  const footer = readFileSync(path.join(ROOT, "components/Footer.tsx"), "utf8");
  const header = readFileSync(path.join(ROOT, "components/SiteHeader.tsx"), "utf8");
  for (const [name, src] of [
    ["site-nav", nav],
    ["content", content],
    ["sitemap", sitemap],
    ["footer", footer],
    ["header", header],
  ]) {
    assert.doesNotMatch(src, /domainiq/i, name);
  }
  const middleware = readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
  assert.match(middleware, /\/api\/factory\//);
});

test("ScaleQuan bay is labeled as ScaleQuan · City Launch", () => {
  const bay = readFileSync(path.join(ROOT, "components/factory/CityLaunchBay.tsx"), "utf8");
  assert.match(bay, /ScaleQuan · City Launch/);
});

test("SiteGrow bay exists and points at client factory routes", () => {
  const bay = readFileSync(path.join(ROOT, "components/factory/SiteGrowBay.tsx"), "utf8");
  assert.match(bay, /SiteGrow · client website factory/);
  assert.match(bay, /\/app\/clients\//);
  assert.match(bay, /\/demo\/client\//);
});

test("inbox leads with a project link into SiteGrow", () => {
  const inbox = readFileSync(path.join(ROOT, "app/app/inbox/page.tsx"), "utf8");
  assert.match(inbox, /lead\.projectId/);
  assert.match(inbox, /\/app\/clients\/\$\{lead\.projectId\}/);
});
