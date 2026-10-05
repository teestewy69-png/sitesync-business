// Day 0 / case-study baseline picker (no network, no Netlify).
//   node --test scripts/baseline-pick.test.mjs        (needs Node >= 22.18 for TypeScript type stripping)
//
// Regression: with workspace.latestBaselineId empty, /case-study and /app/case-study fell back to the newest
// baseline of ANY site, so a demo crawl (Smith Plumbing / Kurtis) was shown as the Sitesinc Day 0.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CASE_STUDY_SITE_ID,
  isCaseStudyBaseline,
  isDemoBaseline,
  isLocalOrigin,
  newestCaseStudyBaseline,
  pickCaseStudyBaseline,
} from "../lib/factory/baseline-pick.ts";
import { FACTORY_PROJECT_ID } from "../lib/factory/types.ts";

const row = (id, capturedAt, origin, siteId) => ({ id, capturedAt, origin, siteId, projectId: siteId });

const sitesincOld = row("b_site_old", "2026-09-01T10:00:00.000Z", "https://sitesinc.co", FACTORY_PROJECT_ID);
const sitesincNew = row("b_site_new", "2026-09-20T10:00:00.000Z", "https://sitesinc.co", FACTORY_PROJECT_ID);
const smith = row("b_smith", "2026-10-01T10:00:00.000Z", "https://sitesinc.co/demo/smith-plumbing", "smith-plumbing");
const kurtis = row("b_kurtis", "2026-10-02T10:00:00.000Z", "https://sitesinc.co/demo/kurtis", "kurtis");
// Older demo crawls defaulted siteId to the case-study id; the /demo/ origin must still exclude them.
const smithLegacyId = row("b_smith_legacy", "2026-10-03T10:00:00.000Z", "http://127.0.0.1:3010/demo/smith-plumbing", FACTORY_PROJECT_ID);
const localhost = row("b_local", "2026-10-04T10:00:00.000Z", "http://localhost:3000", FACTORY_PROJECT_ID);

function deps(rows, workspace = {}) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const calls = { list: 0 };
  return {
    calls,
    deps: {
      latestBaselineId: workspace.latestBaselineId ?? "",
      latestBaselineBySite: workspace.latestBaselineBySite ?? {},
      read: async (id) => byId.get(id) ?? null,
      list: async () => {
        calls.list += 1;
        return rows;
      },
    },
  };
}

test("case-study site id matches FACTORY_PROJECT_ID", () => {
  assert.equal(CASE_STUDY_SITE_ID, FACTORY_PROJECT_ID);
});

test("classifiers: demo / local / case-study", () => {
  assert.equal(isDemoBaseline(smith), true);
  assert.equal(isDemoBaseline(kurtis), true);
  assert.equal(isDemoBaseline(smithLegacyId), true);
  assert.equal(isDemoBaseline(row("x", "", "https://sitesinc.co/demo", FACTORY_PROJECT_ID)), true);
  assert.equal(isDemoBaseline(sitesincNew), false);
  assert.equal(isDemoBaseline(row("x", "", "https://sitesinc.co/demolition-guide", FACTORY_PROJECT_ID)), false);
  assert.equal(isLocalOrigin("http://localhost:3000"), true);
  assert.equal(isLocalOrigin("http://127.0.0.1:3010"), true);
  assert.equal(isLocalOrigin("http://app.localhost"), true);
  assert.equal(isLocalOrigin("https://sitesinc.co"), false);
  assert.equal(isLocalOrigin("https://staging--sitesinc.netlify.app"), false);
  assert.equal(isCaseStudyBaseline(sitesincNew), true);
  assert.equal(isCaseStudyBaseline(row("x", "", "https://staging--sitesinc.netlify.app", FACTORY_PROJECT_ID)), true);
  assert.equal(isCaseStudyBaseline({ id: "legacy", capturedAt: "", origin: "https://sitesinc.co" }), true);
  assert.equal(isCaseStudyBaseline(smith), false);
  assert.equal(isCaseStudyBaseline(kurtis), false);
  assert.equal(isCaseStudyBaseline(smithLegacyId), false);
  assert.equal(isCaseStudyBaseline(localhost), false);
  assert.equal(isCaseStudyBaseline(row("x", "", "https://example.com", "some-other-site")), false);
});

test("empty latestBaselineId: newest demo/localhost baselines are skipped, newest Sitesinc wins", async () => {
  const { deps: d } = deps([sitesincOld, smith, sitesincNew, kurtis, smithLegacyId, localhost]);
  const picked = await pickCaseStudyBaseline(d);
  assert.equal(picked?.id, "b_site_new");
});

test("empty latestBaselineId and only demo baselines: no Day 0 (null), not Smith/Kurtis", async () => {
  const { deps: d } = deps([smith, kurtis, smithLegacyId, localhost]);
  assert.equal(await pickCaseStudyBaseline(d), null);
});

test("latestBaselineId set to a Sitesinc baseline is honored without listing", async () => {
  const { deps: d, calls } = deps([sitesincOld, sitesincNew, smith], { latestBaselineId: "b_site_old" });
  assert.equal((await pickCaseStudyBaseline(d))?.id, "b_site_old");
  assert.equal(calls.list, 0);
});

test("latestBaselineId pointing at a demo or a missing baseline falls through safely", async () => {
  const demo = deps([sitesincOld, smith], { latestBaselineId: "b_smith" });
  assert.equal((await pickCaseStudyBaseline(demo.deps))?.id, "b_site_old");
  const missing = deps([sitesincOld, kurtis], { latestBaselineId: "gone" });
  assert.equal((await pickCaseStudyBaseline(missing.deps))?.id, "b_site_old");
});

test("latestBaselineBySite[case study] is used when latestBaselineId is empty", async () => {
  const { deps: d } = deps([sitesincOld, sitesincNew, smith], {
    latestBaselineBySite: { [FACTORY_PROJECT_ID]: "b_site_old", "smith-plumbing": "b_smith" },
  });
  assert.equal((await pickCaseStudyBaseline(d))?.id, "b_site_old");
});

test("newestCaseStudyBaseline does not depend on input order", () => {
  assert.equal(newestCaseStudyBaseline([sitesincNew, kurtis, sitesincOld, smith])?.id, "b_site_new");
  assert.equal(newestCaseStudyBaseline([]), null);
});
