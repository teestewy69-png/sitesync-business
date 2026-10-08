/**
 * Race-safe revisioned JSON documents on top of Netlify Blobs' create-only write (`onlyIfNew`).
 *
 * WHY: staging verification on real Blobs showed `onlyIfMatch` (ETag compare-and-set) is NOT airtight
 * under overlap: several writers that read the same ETag at the same moment can all get modified:true, so
 * read-modify-write updates are silently lost (typically 7-9 of 10 survived). `onlyIfMatch` on a missing key
 * also answers modified:true without creating anything. `onlyIfNew` was race-safe (single winner, 20/20).
 * So this module never uses `onlyIfMatch`.
 *
 * DESIGN (append-only claims + a hint copy):
 *   - Revision n of document `key` is the claim blob `_rev/<key>/<n padded>` = {rev, id, at, value}.
 *     A writer that last saw revision r writes claim r+1 with `onlyIfNew`. At most ONE writer can win slot r+1;
 *     every other writer that read r gets modified:false = a conflict, re-reads and retries. No lock, no lease,
 *     no expiry, nothing to take over.
 *   - The document key itself (`key`) is a readable copy ("base") carrying `metadata.rev`. It is created with
 *     `onlyIfNew` (revision 1) and rolled forward after each successful claim by a plain unconditional write. It is
 *     only a HINT: the truth is the highest contiguous claim after the base's rev. A reader follows claims
 *     r+1, r+2, ... until one is missing, so a stale/regressed/missing roll-forward can never hide a committed
 *     update, and a writer that crashes after winning its claim has still committed.
 *   - A base without metadata (written by the migration script) is revision 0.
 *   - Old claims are deleted (`KEEP_CLAIMS` newest are kept). A writer would need to be KEEP_CLAIMS revisions
 *     stale to re-claim a deleted slot; with one operator and two tabs that is not reachable.
 *
 * Erasable TypeScript only (no enums / parameter properties) so node can import it for tests.
 */

export const KEEP_CLAIMS = 50;
const MAX_FOLLOW = 5000;

export type RevStore = {
  getWithMetadata(
    key: string,
    opts: { type: "json" }
  ): Promise<{ data: unknown; metadata?: Record<string, unknown> } | null>;
  get(key: string, opts: { type: "json" }): Promise<unknown>;
  setJSON(
    key: string,
    value: unknown,
    opts?: { onlyIfNew?: boolean; metadata?: Record<string, unknown> }
  ): Promise<{ modified: boolean; etag?: string }>;
  delete(key: string): Promise<void>;
};

export class RevConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevConflictError";
  }
}

type Claim = { rev: number; id: string; at: string; value: unknown };

export function claimKey(key: string, rev: number): string {
  return `_rev/${key}/${String(rev).padStart(8, "0")}`;
}

function uniqueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function baseRev(metadata: Record<string, unknown> | undefined): number {
  const raw = Number(metadata?.rev);
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}

export type RevHead = { value: unknown; rev: number };

/**
 * Current head of a revisioned document, or null if it does not exist.
 * Throws whatever the store throws (SyntaxError on a corrupt JSON blob).
 */
export async function readRevisioned(store: RevStore, key: string): Promise<RevHead | null> {
  const base = await store.getWithMetadata(key, { type: "json" });
  const exists = Boolean(base) && base!.data !== null && base!.data !== undefined;
  let value: unknown = exists ? base!.data : undefined;
  let rev = exists ? baseRev(base!.metadata) : 0;
  const startRev = rev;
  for (let followed = 0; followed < MAX_FOLLOW; followed += 1) {
    const next = (await store.get(claimKey(key, rev + 1), { type: "json" })) as Claim | null;
    if (!next || next.rev !== rev + 1) break;
    value = next.value;
    rev = next.rev;
  }
  if (!exists && rev === 0) return null;
  if (rev > startRev) {
    // Best-effort roll-forward of the hint copy; the claims are authoritative either way.
    await rollForward(store, key, value, rev);
  }
  return { value, rev };
}

async function rollForward(store: RevStore, key: string, value: unknown, rev: number): Promise<void> {
  try {
    await store.setJSON(key, value, { metadata: { rev } });
  } catch (err) {
    console.warn(`Revisioned doc ${key}: base roll-forward to rev ${rev} failed (${err instanceof Error ? err.name : "unknown"}); claims remain authoritative.`);
  }
}

/**
 * Commit `value` as the next revision.
 *   expectedRev === null      create-only: fails with RevConflictError if the document exists.
 *   expectedRev === <number>  only if the head is still that revision (otherwise RevConflictError).
 *   expectedRev === undefined last write wins: re-reads the head and claims the next slot, retrying races.
 * Returns the new revision.
 */
export async function writeRevisioned(
  store: RevStore,
  key: string,
  value: unknown,
  expectedRev?: number | null,
  opts: { keepClaims?: number; maxUnconditionalTries?: number } = {}
): Promise<number> {
  const keep = opts.keepClaims ?? KEEP_CLAIMS;
  if (expectedRev === null) {
    const created = await store.setJSON(key, value, { onlyIfNew: true, metadata: { rev: 1 } });
    if (!created.modified) throw new RevConflictError(`Document ${key} already exists.`);
    return 1;
  }
  if (typeof expectedRev === "number") return claimNext(store, key, value, expectedRev, keep);
  const tries = opts.maxUnconditionalTries ?? 25;
  for (let attempt = 1; ; attempt += 1) {
    const head = await readRevisioned(store, key);
    try {
      return head ? await claimNext(store, key, value, head.rev, keep) : await writeRevisioned(store, key, value, null, opts);
    } catch (err) {
      if (err instanceof RevConflictError && attempt < tries) {
        await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 25)));
        continue;
      }
      throw err;
    }
  }
}

async function claimNext(store: RevStore, key: string, value: unknown, fromRev: number, keep: number): Promise<number> {
  const rev = fromRev + 1;
  const claim: Claim = { rev, id: uniqueId(), at: new Date().toISOString(), value };
  const won = await store.setJSON(claimKey(key, rev), claim, { onlyIfNew: true });
  if (!won.modified) throw new RevConflictError(`Document ${key} was changed by another request.`);
  await rollForward(store, key, value, rev);
  if (rev > keep) {
    try {
      await store.delete(claimKey(key, rev - keep));
    } catch {
      /* compaction is best-effort */
    }
  }
  return rev;
}
