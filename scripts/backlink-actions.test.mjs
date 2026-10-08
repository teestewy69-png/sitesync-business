// Focused backlink op checks (no network, no Netlify).
//   node --test scripts/backlink-actions.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  createBacklinkRecord,
  isAddBacklinkOp,
  isPatchBacklinkOp,
  isRemoveBacklinkOp,
  patchBacklinkList,
  removeBacklinkList,
} from "../lib/factory/backlink-ops.ts";

const sample = {
  id: "bl_1",
  referringDomain: "example.com",
  destinationUrl: "https://sitesinc.co/",
  anchor: "sites",
  relevance: "local",
  qualityNotes: "ok",
  acquisitionMethod: "earned",
  discoveredDate: "2026-10-05",
  status: "active",
};

test("op aliases: add / patch / remove recognize kebab and underscore", () => {
  assert.equal(isAddBacklinkOp("add-backlink"), true);
  assert.equal(isAddBacklinkOp("add_backlink"), true);
  assert.equal(isAddBacklinkOp("patch_backlink"), false);
  assert.equal(isPatchBacklinkOp("patch_backlink"), true);
  assert.equal(isPatchBacklinkOp("patch-backlink"), true);
  assert.equal(isRemoveBacklinkOp("remove-backlink"), true);
  assert.equal(isRemoveBacklinkOp("remove_backlink"), true);
  assert.equal(isRemoveBacklinkOp("unknown"), false);
});

test("add → patch → remove: create, update status/fields, then delete by id", () => {
  const created = createBacklinkRecord(
    {
      referringDomain: "news.example",
      destinationUrl: "https://sitesinc.co/blog",
      anchor: "growth",
      relevance: "seo",
      qualityNotes: "[TEST]",
      acquisitionMethod: "manual",
    },
    "bl_test",
    "2026-10-05T12:00:00.000Z"
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.record.id, "bl_test");
  assert.equal(created.record.status, "active");

  let list = [created.record, { ...sample }];

  const patched = patchBacklinkList(list, {
    id: "bl_test",
    status: "lost",
    qualityNotes: "[TEST] cleaned",
  });
  assert.equal(patched.ok, true);
  if (!patched.ok) return;
  list = patched.backlinks;
  const row = list.find((item) => item.id === "bl_test");
  assert.ok(row);
  assert.equal(row.status, "lost");
  assert.equal(row.qualityNotes, "[TEST] cleaned");
  assert.equal(row.referringDomain, "news.example");

  const removed = removeBacklinkList(list, { id: "bl_test" });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.backlinks.length, 1);
  assert.equal(removed.backlinks[0].id, "bl_1");
});

test("unknown / invalid ops and payloads fail cleanly", () => {
  assert.equal(isPatchBacklinkOp("patch-backlinks"), false);
  assert.equal(isRemoveBacklinkOp("delete-backlink"), false);

  const missingFields = createBacklinkRecord({ referringDomain: "x.com" }, "bl_x", "2026-10-05T00:00:00.000Z");
  assert.equal(missingFields.ok, false);
  if (!missingFields.ok) assert.match(missingFields.error, /required/i);

  const badStatus = patchBacklinkList([sample], { id: "bl_1", status: "nope" });
  assert.equal(badStatus.ok, false);
  if (!badStatus.ok) assert.match(badStatus.error, /Invalid backlink status/i);

  const missingId = patchBacklinkList([sample], { status: "lost" });
  assert.equal(missingId.ok, false);

  const notFound = removeBacklinkList([sample], { id: "bl_missing" });
  assert.equal(notFound.ok, false);
  if (!notFound.ok) assert.match(notFound.error, /not found/i);
});
