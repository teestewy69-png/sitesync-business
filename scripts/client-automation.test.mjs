// Client factory automation: baseline status transitions + backfill idempotency (no network).
//   node --test scripts/client-automation.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAutoStageProgression,
  applyBaselineCaptureResult,
  applyBaselineFailure,
  competitorAutomationStatus,
  countDraftedPages,
  initialBaselineAutomation,
  markBaselineStale,
  projectNeedsFactoryBackfill,
  resolveAutomationHostOrigin,
  selectBackfillProjectIds,
  SEARCH_PROVIDER_ENV_KEYS,
} from "../lib/factory/client-automation.ts";

function stage(key, status = "not_started") {
  return {
    key,
    order: 1,
    name: key,
    status,
    requiredInputs: [],
    artifacts: [],
    operatorApproval: false,
    approvedBy: "",
    approvedAt: "",
    completedAt: "",
    notes: "",
  };
}

test("resolveAutomationHostOrigin: explicit wins; never invents production", () => {
  const prev = {
    DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    URL: process.env.URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
  try {
    delete process.env.DEPLOY_PRIME_URL;
    delete process.env.URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const missing = resolveAutomationHostOrigin(null);
    assert.equal(missing.hostOrigin, null);
    assert.equal(missing.source, "none");
    assert.match(missing.reason || "", /No crawl host/);

    const explicit = resolveAutomationHostOrigin("http://127.0.0.1:3000/app");
    assert.equal(explicit.hostOrigin, "http://127.0.0.1:3000");
    assert.equal(explicit.source, "explicit");

    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3010";
    const fromEnv = resolveAutomationHostOrigin("");
    assert.equal(fromEnv.hostOrigin, "http://localhost:3010");
    assert.equal(fromEnv.source, "NEXT_PUBLIC_SITE_URL");
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("baseline status transitions: pending → captured / limited / failed / missing / stale", () => {
  const pending = initialBaselineAutomation("http://127.0.0.1:3000");
  assert.equal(pending.status, "pending");
  assert.equal(pending.hostOrigin, "http://127.0.0.1:3000");

  const missing = initialBaselineAutomation(null, "no host");
  assert.equal(missing.status, "missing");

  const captured = applyBaselineCaptureResult(pending, {
    limited: false,
    pagesOk: 4,
    pagesTotal: 4,
    baselineId: "b1",
    capturedAt: "2026-10-05T12:00:00.000Z",
    hostOrigin: "http://127.0.0.1:3000",
  });
  assert.equal(captured.status, "captured");
  assert.equal(captured.stale, false);
  assert.equal(captured.pagesOk, 4);

  const limited = applyBaselineCaptureResult(pending, {
    limited: true,
    pagesOk: 0,
    pagesTotal: 3,
    baselineId: "b2",
    capturedAt: "2026-10-05T12:01:00.000Z",
  });
  assert.equal(limited.status, "limited");

  const failed = applyBaselineFailure(pending, "ECONNREFUSED", "http://127.0.0.1:3000");
  assert.equal(failed.status, "failed");
  assert.match(failed.reason || "", /ECONNREFUSED/);

  const stale = markBaselineStale(captured, "design changed");
  assert.equal(stale.status, "stale");
  assert.equal(stale.stale, true);

  const missingStays = markBaselineStale(missing, "design changed");
  assert.equal(missingStays.status, "missing");
});

test("auto stage progression completes data stages; leaves human_approval and production_deployment manual", () => {
  const stages = [
    stage("research", "in_progress"),
    stage("blueprint", "ready_for_review"),
    stage("content_briefs", "in_progress"),
    stage("content_drafting", "not_started"),
    stage("human_approval", "not_started"),
    stage("technical_seo", "not_started"),
    stage("production_deployment", "not_started"),
  ];
  const next = applyAutoStageProgression(stages, {
    hasResearchNotes: true,
    blueprintCount: 4,
    briefCount: 3,
    draftedPageCount: 4,
    baselineStatus: "captured",
  });
  const byKey = Object.fromEntries(next.map((s) => [s.key, s.status]));
  assert.equal(byKey.research, "complete");
  assert.equal(byKey.blueprint, "complete");
  assert.equal(byKey.content_briefs, "ready_for_review");
  assert.equal(byKey.content_drafting, "ready_for_review");
  assert.equal(byKey.technical_seo, "complete");
  assert.equal(byKey.human_approval, "not_started");
  assert.equal(byKey.production_deployment, "not_started");
});

test("backfill selection is idempotent", () => {
  const projects = [
    { id: "a" },
    { id: "b", factoryWorkspaceId: "" },
    { id: "c", factoryWorkspaceId: "c" },
  ];
  assert.deepEqual(selectBackfillProjectIds(projects), ["a", "b"]);
  assert.equal(projectNeedsFactoryBackfill(projects[2]), false);
  const after = projects.map((p) =>
    selectBackfillProjectIds(projects).includes(p.id)
      ? { ...p, factoryWorkspaceId: p.id }
      : p
  );
  assert.deepEqual(selectBackfillProjectIds(after), []);
});

test("competitor automation reports needs_search_provider when no SERP env key", () => {
  const saved = {};
  for (const key of SEARCH_PROVIDER_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    const status = competitorAutomationStatus([{ competitorUrls: [] }]);
    assert.equal(status.status, "needs_search_provider");
    assert.match(status.detail, /SERPER|BRAVE|search/i);

    const filled = competitorAutomationStatus([
      { competitorUrls: ["https://example.com"] },
    ]);
    assert.equal(filled.status, "filled");
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("countDraftedPages counts non-empty bodies", () => {
  assert.equal(
    countDraftedPages([
      { body: "", status: "planned" },
      { body: "hello world", status: "ready_for_review" },
    ]),
    1
  );
});
