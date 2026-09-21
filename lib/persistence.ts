import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectLambda, getStore, type Store } from "@netlify/blobs";

export type StoreBackend = "local-json" | "netlify-blobs";

const LOCAL_DIR = path.join(process.cwd(), "data", "store");
const BLOB_STORE_NAME = "sitesinc-crm";

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
  return BLOB_STORE_NAME;
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

export function getCrmStore(): Store {
  try {
    return getStore({
      name: BLOB_STORE_NAME,
      consistency: "strong",
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : "unknown";
    console.error(`Netlify Blobs getStore failed (${BLOB_STORE_NAME}): ${detail}`);
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
  if (storeBackend() !== "netlify-blobs") {
    const records = await readLocal<T & { id: string }>(collection);
    return (records.find((item) => item.id === id) as T | undefined) || null;
  }
  const store = getCrmStore();
  const value = await store.get(`${collection}/${id}`, { type: "json" });
  return (value as T) || null;
}

export async function writeIndex(key: string, value: string): Promise<void> {
  if (storeBackend() !== "netlify-blobs") return;
  const store = getCrmStore();
  await store.set(key, value);
}

export async function readIndex(key: string): Promise<string | null> {
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
