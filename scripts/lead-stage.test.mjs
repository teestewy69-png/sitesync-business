// Operator pipeline stages: new / in progress / paid / done / closed.
//   node --test scripts/lead-stage.test.mjs
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { LEAD_STAGES, isLeadStage, stageLabel, stageOf } = await import("../lib/lead-stage.ts");

test("done is a first-class operator stage, distinct from closed", () => {
  assert.deepEqual([...LEAD_STAGES], ["new", "in_progress", "paid", "done", "closed"]);
  assert.equal(isLeadStage("done"), true);
  assert.equal(stageLabel("done"), "Done");
  assert.equal(stageLabel("closed"), "Closed");
  assert.equal(stageOf({}), "new");
  assert.equal(stageOf({ stage: "done" }), "done");
  assert.equal(stageOf({ stage: "bogus" }), "new");
});
