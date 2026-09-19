import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoreBackend = "local-json" | "netlify-blobs";

const LOCAL_DIR = path.join(process.cwd(), "data", "store");

export function storeBackend(): StoreBackend {
  if (process.env.SITESINC_STORE === "local") return "local-json";
  if (process.env.SITESINC_STORE === "blobs") return "netlify-blobs";
  if (process.env.NETLIFY) return "netlify-blobs";
  return "local-json";
}

export function storeIsDurable(): boolean {
  return storeBackend() === "netlify-blobs";
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

async function readBlobs<T>(key: string): Promise<T[]> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "sitesinc-crm", consistency: "strong" });
  const records = await store.get(key, { type: "json" });
  return Array.isArray(records) ? (records as T[]) : [];
}

async function writeBlobs<T>(key: string, records: T[]): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "sitesinc-crm", consistency: "strong" });
  await store.setJSON(key, records);
}

export async function readRecords<T>(key: string): Promise<T[]> {
  return storeBackend() === "netlify-blobs" ? readBlobs<T>(key) : readLocal<T>(key);
}

export async function writeRecords<T>(key: string, records: T[]): Promise<void> {
  if (storeBackend() === "netlify-blobs") {
    await writeBlobs(key, records);
    return;
  }
  await writeLocal(key, records);
}
