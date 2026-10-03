import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectLambda, getStore, type Store } from "@netlify/blobs";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { isStagingEnv } from "@/lib/site-env";

export type StoreBackend = "local-json" | "netlify-blobs";

const LOCAL_DIR = path.join(process.cwd(), "data", "store");
const BLOB_STORE_NAME = "sitesinc-crm";
const STAGING_BLOB_STORE_NAME = "sitesinc-crm-staging";

export function envFlag(name: string): string {
  return (process.env[name] || "").trim();
}

export function isNetlifyHost(): boolean {
  const context = envFlag("CONTEXT");
  return (
    envFlag("NETLIFY") === "true" ||
    Boolean(envFlag("NETLIFY_BLOBS_CONTEXT")) ||
    Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext) ||
    context === "deploy-preview" ||
    context === "production" ||
    context === "branch-deploy" ||
    Boolean(envFlag("SITE_ID")) ||
    Boolean(envFlag("AWS_LAMBDA_FUNCTION_NAME"))
  );
}

export function storeBackend(): StoreBackend {
  const forced = envFlag("SITESINC_STORE");
  if (forced === "local") {
    if (isNetlifyHost()) {
      throw new Error("SITESINC_STORE=local is not allowed on Netlify.");
    }
    return "local-json";
  }
  if (forced === "blobs" || isNetlifyHost()) return "netlify-blobs";
  return "local-json";
}

export function storeIsDurable(): boolean {
  return storeBackend() === "netlify-blobs";
}

export function blobStoreName(): string {
  return isStagingEnv() ? STAGING_BLOB_STORE_NAME : BLOB_STORE_NAME;
}

export function blobsContextPresent(): boolean {
  return Boolean(
    envFlag("NETLIFY_BLOBS_CONTEXT") ||
      (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext
  );
}

export function ensureBlobsFromRequest(req: { headers: Headers }): void {
  if (blobsContextPresent()) return;
  const encoded = req.headers.get("x-nf-blobs") || req.headers.get("X-Nf-Blobs");
  if (!encoded) return;
  try {
    connectLambda({
      blobs: encoded,
      headers: Object.fromEntries(req.headers.entries()),
    });
  } catch (err) {
    console.error(
      "Netlify Blobs request context failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
  }
}

/**
 * Shared Blobs context setup for server-rendered code. Server components and helpers cannot see the
 * request object, so this reads the current request headers itself (next/headers) and connects Blobs
 * from the `x-nf-blobs` header when the runtime did not inject NETLIFY_BLOBS_CONTEXT.
 *
 * Every document/record function below calls it, so a server page that reads factory state can never
 * forget it. It is a no-op with the local-json backend, when the runtime already provides the
 * context, and outside a request scope (scripts). Next's internal control-flow errors (dynamic
 * rendering bail-outs) are re-thrown so static/dynamic detection keeps working.
 */
export async function ensureBlobsContext(): Promise<void> {
  if (storeBackend() !== "netlify-blobs") return;
  if (blobsContextPresent()) return;
  try {
    ensureBlobsFromRequest({ headers: await headers() });
  } catch (err) {
    unstable_rethrow(err);
    // Not inside a request (e.g. a script): nothing to connect.
  }
}

/** Alias for pages: `await getFactoryContext()` is equivalent to the automatic call inside the store functions. */
export const getFactoryContext = ensureBlobsContext;

export function getCrmStore(): Store {
  const name = blobStoreName();
  try {
    return getStore({
      name,
      consistency: "strong",
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : "unknown";
    console.error(`Netlify Blobs getStore failed (${name}): ${detail}`);
    throw new Error(`Netlify Blobs is unavailable (${detail}). Local filesystem storage is not used on this host.`);
  }
}

async function readLocal<T>(key: string): Promise<T[]> {
  try {
    const raw = await readFile(path.join(LOCAL_DIR, `${key}.json`), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function writeLocal<T>(key: string, records: T[]): Promise<void> {
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, `${key}.json`), `${JSON.stringify(records, null, 2)}\n`);
}

export async function readRecords<T>(key: string): Promise<T[]> {
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") return readLocal<T>(key);
  const store = getCrmStore();
  const listed = await store.list({ prefix: `${key}/` });
  const records: T[] = [];
  for (const blob of listed.blobs ?? []) {
    const value = await store.get(blob.key, { type: "json" });
    if (value) records.push(value as T);
  }
  return records;
}

export async function writeRecord<T extends { id: string }>(
  collection: string,
  record: T
): Promise<void> {
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    const records = await readLocal<T>(collection);
    const next = records.some((item) => item.id === record.id)
      ? records.map((item) => (item.id === record.id ? record : item))
      : [...records, record];
    await writeLocal(collection, next);
    return;
  }
  const store = getCrmStore();
  try {
    await store.setJSON(`${collection}/${record.id}`, record);
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : "unknown";
    console.error(`Netlify Blobs setJSON failed for ${collection}: ${detail}`);
    throw new Error(`Netlify Blobs write failed (${detail}).`);
  }
}

export async function readRecord<T>(collection: string, id: string): Promise<T | null> {
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    const records = await readLocal<T & { id: string }>(collection);
    return (records.find((item) => item.id === id) as T | undefined) || null;
  }
  const store = getCrmStore();
  const value = await store.get(`${collection}/${id}`, { type: "json" });
  return (value as T) || null;
}

export async function writeIndex(key: string, value: string): Promise<void> {
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") return;
  const store = getCrmStore();
  await store.set(key, value);
}

export async function readIndex(key: string): Promise<string | null> {
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") return null;
  const store = getCrmStore();
  return store.get(key, { type: "text" });
}

export async function writeRecords<T>(key: string, records: T[]): Promise<void> {
  if (storeBackend() === "netlify-blobs") {
    throw new Error("Bulk array writes are not used on Netlify Blobs.");
  }
  await writeLocal(key, records);
}

/* ------------------------------------------------------------------------- */
/* Generic document + binary store (factory / SEO state).                    */
/*                                                                           */
/* Same backend selection as the CRM records above: Netlify Blobs on Netlify */
/* (the staging site uses the separate `sitesinc-crm-staging` store, exactly */
/* like leads), local files under ./data when running locally.               */
/*                                                                           */
/* Keys are namespaced paths such as `factory/workspace`. Locally a JSON     */
/* document key maps to `data/<key>.json` and a binary key to `data/<key>`.  */
/* Writes NEVER fail silently: every failure throws a StoreError.            */
/* ------------------------------------------------------------------------- */

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const DOC_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]*(\/[a-z0-9][a-z0-9_.-]*)*$/i;

export type StoreErrorKind = "read" | "write" | "conflict" | "corrupt";

export class StoreError extends Error {
  readonly kind: StoreErrorKind;
  constructor(kind: StoreErrorKind, message: string) {
    super(message);
    this.name = "StoreError";
    this.kind = kind;
  }
}

export function isStoreConflict(err: unknown): boolean {
  return err instanceof StoreError && err.kind === "conflict";
}

function errDetail(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    return code ? `${err.name} ${code}` : `${err.name}: ${err.message}`;
  }
  return "unknown";
}

function assertDocKey(key: string): void {
  if (key.length > 200 || key.includes("..") || !DOC_KEY_PATTERN.test(key)) {
    throw new StoreError("write", `Invalid store key "${key.slice(0, 80)}".`);
  }
}

function localDocFile(key: string): string {
  return path.join(LOCAL_DATA_DIR, `${key}.json`);
}

function localBinaryFile(key: string): string {
  return path.join(LOCAL_DATA_DIR, key);
}

function versionOfText(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

let warnedNoEtag = false;
let localDocChain: Promise<unknown> = Promise.resolve();

function withLocalLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = localDocChain.then(fn);
  localDocChain = run.catch(() => undefined);
  return run;
}

async function readLocalText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export type DocRead<T> = { value: T; version: string };

/**
 * Read a JSON document. Returns null only when the key does not exist.
 * Unreadable / unparseable data throws (it is never treated as "missing").
 */
export async function readDoc<T>(key: string): Promise<DocRead<T> | null> {
  assertDocKey(key);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    let raw: string | null;
    try {
      raw = await readLocalText(localDocFile(key));
    } catch (err) {
      throw new StoreError("read", `Local store read failed for ${key} (${errDetail(err)}).`);
    }
    if (raw === null) return null;
    try {
      return { value: JSON.parse(raw) as T, version: versionOfText(raw) };
    } catch {
      throw new StoreError("corrupt", `Stored document ${key} is not valid JSON; refusing to overwrite it.`);
    }
  }
  let found: { data: unknown; etag?: string } | null;
  try {
    found = (await getCrmStore().getWithMetadata(key, { type: "json" })) as {
      data: unknown;
      etag?: string;
    } | null;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new StoreError("corrupt", `Stored document ${key} is not valid JSON; refusing to overwrite it.`);
    }
    throw new StoreError("read", `Netlify Blobs read failed for ${key} (${errDetail(err)}).`);
  }
  if (!found || found.data === null || found.data === undefined) return null;
  return { value: found.data as T, version: found.etag || "" };
}

/**
 * Write a JSON document and return its new version.
 *  - expectedVersion undefined: unconditional (last write wins).
 *  - expectedVersion null:      create only; conflicts if the key already exists.
 *  - expectedVersion string:    only if the stored version still matches (ETag on Blobs,
 *                               content hash locally); otherwise throws a conflict StoreError.
 * Any failure throws; callers must surface it.
 */
export async function writeDoc<T>(
  key: string,
  value: T,
  opts: { expectedVersion?: string | null } = {}
): Promise<string> {
  assertDocKey(key);
  const expected = opts.expectedVersion;
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    return withLocalLock(async () => {
      try {
        const file = localDocFile(key);
        if (expected !== undefined) {
          const raw = await readLocalText(file);
          const current = raw === null ? null : versionOfText(raw);
          if (current !== expected) {
            throw new StoreError("conflict", `Document ${key} was changed by another request.`);
          }
        }
        const text = `${JSON.stringify(value, null, 2)}\n`;
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, text, "utf8");
        return versionOfText(text);
      } catch (err) {
        if (err instanceof StoreError) throw err;
        console.error(`Local store write failed for ${key}: ${errDetail(err)}`);
        throw new StoreError("write", `Local store write failed for ${key} (${errDetail(err)}).`);
      }
    });
  }
  let result: { modified: boolean; etag?: string };
  try {
    const store = getCrmStore();
    if (expected === null) result = await store.setJSON(key, value, { onlyIfNew: true });
    else if (expected) result = await store.setJSON(key, value, { onlyIfMatch: expected });
    else {
      if (expected === "" && !warnedNoEtag) {
        warnedNoEtag = true;
        console.warn("Netlify Blobs returned no ETag on read; factory writes are unconditional (last write wins).");
      }
      result = await store.setJSON(key, value);
    }
  } catch (err) {
    console.error(`Netlify Blobs setJSON failed for ${key}: ${errDetail(err)}`);
    throw new StoreError("write", `Netlify Blobs write failed for ${key} (${errDetail(err)}).`);
  }
  if (!result.modified) {
    throw new StoreError("conflict", `Document ${key} was changed by another request.`);
  }
  return result.etag || "";
}

/** List the keys of JSON documents under a prefix such as `factory/baselines/`. */
export async function listDocKeys(prefix: string): Promise<string[]> {
  const base = prefix.replace(/\/+$/, "");
  assertDocKey(base);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    try {
      const names = await readdir(path.join(LOCAL_DATA_DIR, base));
      return names.filter((name) => name.endsWith(".json")).map((name) => `${base}/${name.slice(0, -5)}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new StoreError("read", `Local store list failed for ${base} (${errDetail(err)}).`);
    }
  }
  try {
    const listed = await getCrmStore().list({ prefix: `${base}/` });
    return (listed.blobs ?? []).map((blob) => blob.key);
  } catch (err) {
    throw new StoreError("read", `Netlify Blobs list failed for ${base} (${errDetail(err)}).`);
  }
}

/** Read a binary object (e.g. an uploaded screenshot). Null when missing. */
export async function readBinary(key: string): Promise<Buffer | null> {
  assertDocKey(key);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    try {
      return await readFile(localBinaryFile(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new StoreError("read", `Local store read failed for ${key} (${errDetail(err)}).`);
    }
  }
  try {
    const data = (await getCrmStore().get(key, { type: "arrayBuffer" })) as ArrayBuffer | null;
    return data ? Buffer.from(data) : null;
  } catch (err) {
    throw new StoreError("read", `Netlify Blobs read failed for ${key} (${errDetail(err)}).`);
  }
}

/** Write a binary object. Throws on any failure. */
export async function writeBinary(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
  assertDocKey(key);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    try {
      const file = localBinaryFile(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      return;
    } catch (err) {
      console.error(`Local store write failed for ${key}: ${errDetail(err)}`);
      throw new StoreError("write", `Local store write failed for ${key} (${errDetail(err)}).`);
    }
  }
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    await getCrmStore().set(key, copy.buffer, contentType ? { metadata: { contentType } } : undefined);
  } catch (err) {
    console.error(`Netlify Blobs set failed for ${key}: ${errDetail(err)}`);
    throw new StoreError("write", `Netlify Blobs write failed for ${key} (${errDetail(err)}).`);
  }
}

/**
 * Honest write+read probe of the document store used by factory/SEO state
 * (local: data/factory is writable; Blobs: the store accepts writes). Never throws.
 */
export async function docStoreHealth(): Promise<{ ok: boolean; backend: StoreBackend; detail: string }> {
  const backend = storeBackend();
  try {
    const at = new Date().toISOString();
    await writeDoc("factory/health-probe", { at });
    const back = await readDoc<{ at: string }>("factory/health-probe");
    if (back?.value?.at !== at) {
      return { ok: false, backend, detail: "Factory store probe could not be read back." };
    }
    return { ok: true, backend, detail: `Factory store (${backend}) accepts writes.` };
  } catch (err) {
    return { ok: false, backend, detail: err instanceof Error ? err.message : "Factory store probe failed." };
  }
}
