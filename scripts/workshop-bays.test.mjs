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
