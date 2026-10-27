import assert from "node:assert/strict";
import test from "node:test";
import { isKurtisProject, KURTIS_INTAKE } from "./run-kurtis-factory.mjs";

test("Kurtis intake is an artist with owned kurtisart.com, not a city-launch plumbing client", () => {
  assert.equal(KURTIS_INTAKE.businessType, "Artist");
  assert.equal(KURTIS_INTAKE.domain, "kurtisart.com");
  assert.match(KURTIS_INTAKE.notes, /City Launch skipped/);
  assert.match(KURTIS_INTAKE.notes, /DNS/);
});

test("Kurtis project matcher uses owned domain or name, not smith-plumbing", () => {
  assert.equal(isKurtisProject({ ownedDomain: "kurtisart.com", businessName: "Other" }), true);
  assert.equal(isKurtisProject({ selectedDomain: "www.kurtisart.com", businessName: "x" }), true);
  assert.equal(isKurtisProject({ businessName: "Kurtis Wells" }), true);
  assert.equal(isKurtisProject({ label: "Kurtisart studio" }), true);
  assert.equal(isKurtisProject({ businessName: "Smith Plumbing", ownedDomain: "smithplumbing.com" }), false);
});
