/**
 * Private deliverables store. Netlify Blobs store `sitesinc-deliverables` (staging:
 * `sitesinc-deliverables-staging`); locally `data/private/deliverables/` (git-ignored).
 * Blobs are never publicly addressable: files only leave through /api/download/[token].
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore, type Store } from "@netlify/blobs";
import { ensureBlobsContext, storeBackend } from "@/lib/persistence";
import { isStagingEnv } from "@/lib/site-env";

const LOCAL_DIR = path.join(process.cwd(), "data", "private", "deliverables");
const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]*(\/[a-z0-9][a-z0-9_.-]*)*$/i;

export function deliverablesStoreName(): string {
  return isStagingEnv() ? "sitesinc-deliverables-staging" : "sitesinc-deliverables";
}

export function assertFileKey(key: string): void {
  if (!key || key.length > 200 || key.includes("..") || !KEY_PATTERN.test(key)) {
    throw new Error("Invalid deliverable file key.");
  }
}

function blobStore(): Store {
  return getStore({ name: deliverablesStoreName(), consistency: "strong" });
}

function localFile(key: string): string {
  return path.join(LOCAL_DIR, ...key.split("/"));
}

export async function writePrivateFile(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  assertFileKey(key);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    const file = localFile(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.meta.json`, JSON.stringify({ contentType, size: bytes.byteLength, at: new Date().toISOString() }));
    return;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  await blobStore().set(key, copy.buffer, { metadata: { contentType, size: bytes.byteLength, at: new Date().toISOString() } });
}

export async function readPrivateFile(key: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  assertFileKey(key);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    try {
      const bytes = await readFile(localFile(key));
      let contentType = "application/octet-stream";
      try {
        contentType = (JSON.parse(await readFile(`${localFile(key)}.meta.json`, "utf8")) as { contentType?: string }).contentType || contentType;
      } catch {
        // no sidecar metadata
      }
      return { bytes, contentType };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
  const found = await blobStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!found) return null;
  const contentType = String((found.metadata as { contentType?: string } | undefined)?.contentType || "application/octet-stream");
  return { bytes: Buffer.from(found.data as ArrayBuffer), contentType };
}

export async function privateFileExists(key: string): Promise<boolean> {
  assertFileKey(key);
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    try {
      return (await stat(localFile(key))).isFile();
    } catch {
      return false;
    }
  }
  return Boolean(await blobStore().getMetadata(key));
}

/** Uploaded static deliverables (the `kits/` prefix), for the factory bay. */
export async function listPrivateFiles(prefix = "kits"): Promise<string[]> {
  await ensureBlobsContext();
  if (storeBackend() !== "netlify-blobs") {
    try {
      const names = await readdir(path.join(LOCAL_DIR, prefix));
      return names.filter((n) => !n.endsWith(".meta.json")).map((n) => `${prefix}/${n}`);
    } catch {
      return [];
    }
  }
  const listed = await blobStore().list({ prefix: `${prefix}/` });
  return (listed.blobs || []).map((b) => b.key);
}
