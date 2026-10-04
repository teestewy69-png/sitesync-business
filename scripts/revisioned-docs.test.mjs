// Concurrency tests for the Blobs write path. No network, no Netlify.
//   node --test scripts/revisioned-docs.test.mjs        (needs Node >= 22.18 for TypeScript type stripping)
//
// The simulated store reproduces what staging verification saw on REAL Blobs:
//   * onlyIfNew is atomic (single winner);
//   * onlyIfMatch accepts a STALE ETag when it was superseded only moments ago (several writers that read the
//     same ETag all get modified:true), so ETag read-modify-write loses updates;
//   * onlyIfMatch on a missing key answers modified:true but creates nothing.
import assert from "node:assert/strict";
import test from "node:test";
import { KEEP_CLAIMS, RevConflictError, claimKey, readRevisioned, writeRevisioned } from "../lib/revisioned-docs.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const jitter = (max) => sleep(1 + Math.floor(Math.random() * max));

function makeSim({ staleWindowMs = 4, failBaseWrites = 0 } = {}) {
  const docs = new Map(); // key -> {json, etag, metadata}
  const superseded = new Map(); // etag -> time it stopped being current
  let counter = 0;
  const stats = { staleAccepted: 0 };
  const nextEtag = () => `"e${(counter += 1)}"`;
  const store = {
    async getWithMetadata(key) {
      await jitter(5);
      const doc = docs.get(key);
      await jitter(3);
      if (!doc) return null;
      return { data: JSON.parse(doc.json), etag: doc.etag, metadata: doc.metadata };
    },
    async get(key) {
      await jitter(5);
      const doc = docs.get(key);
      return doc ? JSON.parse(doc.json) : null;
    },
    async delete(key) {
      await jitter(3);
      docs.delete(key);
    },
    async setJSON(key, value, opts = {}) {
      await jitter(5); // request travel time; the check+write below is one atomic step
      if (opts.metadata && failBaseWrites && !opts.onlyIfNew && Math.random() < failBaseWrites) throw new Error("simulated base write failure");
      const current = docs.get(key);
      if (opts.onlyIfNew && current) return { modified: false };
      if (opts.onlyIfMatch !== undefined) {
        if (!current) return { modified: true, etag: "" }; // real quirk: reports success, creates nothing
        if (current.etag !== opts.onlyIfMatch) {
          const when = superseded.get(opts.onlyIfMatch);
          const recentlyCurrent = when !== undefined && Date.now() - when <= staleWindowMs;
          if (!recentlyCurrent) return { modified: false };
          stats.staleAccepted += 1; // real quirk: stale ETag accepted while writers overlap
        }
      }
      if (current) superseded.set(current.etag, Date.now());
      const etag = nextEtag();
      docs.set(key, { json: JSON.stringify(value), etag, metadata: opts.metadata });
      return { modified: true, etag };
    },
  };
  return { store, docs, stats };
}

/** The OLD algorithm (what lib/persistence.ts + applyUpdate did): ETag read, onlyIfMatch write, up to 10 tries. */
async function oldUpdate(store, key, mutate) {
  for (let attempt = 1; ; attempt += 1) {
    const found = await store.getWithMetadata(key);
    const next = mutate(found ? structuredClone(found.data) : { ids: [] });
    const res = found
      ? await store.setJSON(key, next, { onlyIfMatch: found.etag })
      : await store.setJSON(key, next, { onlyIfNew: true });
    if (res.modified) return true;
    if (attempt >= 10) return false;
    await sleep(20 * attempt + Math.floor(Math.random() * 40));
  }
}

/** The NEW algorithm: revisioned read + claim, same retry shape as applyUpdate. */
async function newUpdate(store, key, mutate, maxAttempts = 30) {
  for (let attempt = 1; ; attempt += 1) {
    const head = await readRevisioned(store, key);
    const next = mutate(head ? structuredClone(head.value) : { ids: [] });
    try {
      await writeRevisioned(store, key, next, head ? head.rev : null);
      return true;
    } catch (err) {
      if (err instanceof RevConflictError && attempt < maxAttempts) {
        await sleep(Math.min(20 * attempt, 150) + Math.floor(Math.random() * 40));
        continue;
      }
      if (err instanceof RevConflictError) return false;
      throw err;
    }
  }
}

async function trial(update, writers, simOpts) {
  const { store } = makeSim(simOpts);
  const key = "factory/workspace";
  // existing document, like a real workspace (created through the same path the app uses)
  if (update === oldUpdate) await store.setJSON(key, { ids: [] }, { onlyIfNew: true });
  else await writeRevisioned(store, key, { ids: [] }, null);
  const outcomes = await Promise.all(
    Array.from({ length: writers }, (_, i) => update(store, key, (doc) => ({ ids: [...doc.ids, `w${i}`] })))
  );
  const final =
    update === oldUpdate ? (await store.getWithMetadata(key)).data : (await readRevisioned(store, key)).value;
  const reportedOk = outcomes.filter(Boolean).length;
  return { reportedOk, survived: final.ids.length, lost: reportedOk - final.ids.length, unique: new Set(final.ids).size };
}

async function many(update, writers, trials, simOpts) {
  let lost = 0;
  let failedAfterRetries = 0;
  let worstSurvived = writers;
  for (let t = 0; t < trials; t += 1) {
    const r = await trial(update, writers, simOpts);
    lost += r.lost;
    failedAfterRetries += writers - r.reportedOk;
    worstSurvived = Math.min(worstSurvived, r.survived);
    assert.equal(r.unique, r.survived, "no duplicated ids");
  }
  return { lost, failedAfterRetries, worstSurvived };
}

test("OLD onlyIfMatch algorithm loses updates under overlap (reproduces the staging finding)", { timeout: 300000 }, async () => {
  const out10 = await many(oldUpdate, 10, 12);
  const out20 = await many(oldUpdate, 20, 6);
  console.log(`    OLD 10-way x12: silently lost=${out10.lost}, worst trial kept ${out10.worstSurvived}/10`);
  console.log(`    OLD 20-way x6 : silently lost=${out20.lost}, worst trial kept ${out20.worstSurvived}/20`);
  assert.ok(out10.lost > 0 || out10.worstSurvived < 10, "the simulation must reproduce lost updates with the old code");
});

test("NEW revisioned algorithm: zero lost updates at 10-way and 20-way concurrency", { timeout: 600000 }, async () => {
  const out10 = await many(newUpdate, 10, 30);
  const out20 = await many(newUpdate, 20, 20);
  console.log(`    NEW 10-way x30: lost=${out10.lost}, gave up=${out10.failedAfterRetries}, worst trial kept ${out10.worstSurvived}/10`);
  console.log(`    NEW 20-way x20: lost=${out20.lost}, gave up=${out20.failedAfterRetries}, worst trial kept ${out20.worstSurvived}/20`);
  assert.equal(out10.lost, 0);
  assert.equal(out20.lost, 0);
  assert.equal(out10.failedAfterRetries, 0);
  assert.equal(out20.failedAfterRetries, 0);
  assert.equal(out10.worstSurvived, 10);
  assert.equal(out20.worstSurvived, 20);
});

test("NEW algorithm stays correct when the base copy is often not rolled forward (claims are authoritative)", { timeout: 300000 }, async () => {
  const warn = console.warn;
  console.warn = () => {};
  let out;
  try {
    out = await many(newUpdate, 10, 15, { failBaseWrites: 0.5 });
  } finally {
    console.warn = warn;
  }
  assert.equal(out.lost, 0);
  assert.equal(out.worstSurvived, 10);
});

test("create race: 10 simultaneous creators -> exactly one winner; missing key never relies on onlyIfMatch", async () => {
  const { store, docs } = makeSim();
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      writeRevisioned(store, "factory/checklists/x", { by: i }, null).then(() => "won", (err) => (err instanceof RevConflictError ? "lost" : "error"))
    )
  );
  assert.equal(results.filter((r) => r === "won").length, 1);
  assert.equal(results.filter((r) => r === "lost").length, 9);
  assert.equal(results.includes("error"), false);
  assert.equal(docs.has("factory/checklists/x"), true);
  // unconditional write on a missing key really creates it
  const sim2 = makeSim();
  await writeRevisioned(sim2.store, "factory/workspace", { a: 1 });
  assert.deepEqual((await readRevisioned(sim2.store, "factory/workspace")).value, { a: 1 });
});

test("stale expected revision is a conflict (never silently accepted)", async () => {
  const { store } = makeSim();
  await writeRevisioned(store, "factory/workspace", { n: 0 }, null); // rev 1
  await writeRevisioned(store, "factory/workspace", { n: 1 }, 1); // rev 2
  await assert.rejects(writeRevisioned(store, "factory/workspace", { n: "stale" }, 1), RevConflictError);
  assert.deepEqual((await readRevisioned(store, "factory/workspace")).value, { n: 1 });
});

test("migrated base without metadata is revision 0 and can be updated; compaction keeps the head readable", async () => {
  const { store, docs } = makeSim();
  await store.setJSON("factory/workspace", { migrated: true, n: 0 }, { onlyIfNew: true }); // like scripts/migrate-factory-state.mjs
  let head = await readRevisioned(store, "factory/workspace");
  assert.equal(head.rev, 0);
  for (let i = 1; i <= KEEP_CLAIMS + 15; i += 1) {
    await writeRevisioned(store, "factory/workspace", { migrated: true, n: i }, head.rev, { keepClaims: KEEP_CLAIMS });
    head = await readRevisioned(store, "factory/workspace");
    assert.equal(head.rev, i);
  }
  assert.equal(head.value.n, KEEP_CLAIMS + 15);
  assert.equal(docs.has(claimKey("factory/workspace", 1)), false, "old claims are compacted");
  assert.equal(docs.has(claimKey("factory/workspace", head.rev)), true, "newest claim is kept");
});

test("a writer that dies after winning its claim has still committed (reader follows the claim)", async () => {
  const { store } = makeSim();
  await writeRevisioned(store, "factory/workspace", { n: 0 }, null); // rev 1, base rev 1
  // simulate: claim 2 written, base never rolled forward
  await store.setJSON(claimKey("factory/workspace", 2), { rev: 2, id: "x", at: "t", value: { n: 99 } }, { onlyIfNew: true });
  const head = await readRevisioned(store, "factory/workspace");
  assert.equal(head.rev, 2);
  assert.equal(head.value.n, 99);
  await assert.rejects(writeRevisioned(store, "factory/workspace", { n: 5 }, 1), RevConflictError, "stale writer cannot overwrite it");
});

test("corrupt blob surfaces as an error (SyntaxError), is not treated as missing", async () => {
  const { store, docs } = makeSim();
  docs.set("factory/workspace", { json: "{not json", etag: '"x"', metadata: { rev: 1 } });
  await assert.rejects(readRevisioned(store, "factory/workspace"), SyntaxError);
});
