/**
 * Local backfill: init-client-factory for CRM ClientProjects lacking factoryWorkspaceId.
 * Does NOT push, does NOT touch Netlify, does NOT merge master.
 *
 * Prefer running against the local store with the factory action (when dev server is up):
 *   POST /api/factory/action  { "op": "backfill-client-factories", "hostOrigin": "http://127.0.0.1:3000" }
 *
 * This script documents the op and exercises the pure selection helper (idempotency).
 * It does not call a remote store.
 *
 *   node scripts/backfill-client-factories.mjs
 */
import assert from "node:assert/strict";
import {
  projectNeedsFactoryBackfill,
  selectBackfillProjectIds,
} from "../lib/factory/client-automation.ts";

const samples = [
  { id: "proj_thin_a" },
  { id: "proj_thin_b", factoryWorkspaceId: "" },
  { id: "proj_ready", factoryWorkspaceId: "proj_ready" },
  { id: "proj_ready2", factoryWorkspaceId: "proj_ready2" },
];

const needing = selectBackfillProjectIds(samples);
assert.deepEqual(needing, ["proj_thin_a", "proj_thin_b"]);
assert.equal(projectNeedsFactoryBackfill(samples[0]), true);
assert.equal(projectNeedsFactoryBackfill(samples[2]), false);

// Second pass (idempotency of selection): once ids are set, selection is empty.
const after = samples.map((p) =>
  needing.includes(p.id) ? { ...p, factoryWorkspaceId: p.id } : p
);
assert.deepEqual(selectBackfillProjectIds(after), []);

console.log(
  JSON.stringify(
    {
      ok: true,
      note: "Pure backfill selection is idempotent. Run factory action backfill-client-factories against local store to apply.",
      wouldInitialize: needing,
      afterSkip: selectBackfillProjectIds(after),
    },
    null,
    2
  )
);
