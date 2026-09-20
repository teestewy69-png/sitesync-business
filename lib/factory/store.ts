import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BaselineSnapshot, FactoryWorkspace } from "./types";

const STORE_DIR = path.join(process.cwd(), "data", "store");
const WORKSPACE_FILE = path.join(STORE_DIR, "factory.json");
const BASELINES_FILE = path.join(STORE_DIR, "factory-baselines.json");
export const UPLOAD_DIR = path.join(STORE_DIR, "uploads");

let writeChain: Promise<void> = Promise.resolve();

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  let result: T;
  const run = writeChain.then(async () => {
    result = await work();
  });
  writeChain = run.catch(() => undefined);
  return run.then(() => result);
}

export async function readWorkspace(): Promise<FactoryWorkspace | null> {
  const data = await readJson<FactoryWorkspace | null>(WORKSPACE_FILE, null);
  return data;
}

export function saveWorkspace(workspace: FactoryWorkspace): Promise<FactoryWorkspace> {
  return enqueue(async () => {
    await writeJson(WORKSPACE_FILE, workspace);
    return workspace;
  });
}

export async function listBaselines(): Promise<BaselineSnapshot[]> {
  const rows = await readJson<BaselineSnapshot[]>(BASELINES_FILE, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveBaseline(snapshot: BaselineSnapshot): Promise<BaselineSnapshot> {
  return enqueue(async () => {
    const rows = await listBaselines();
    rows.push(snapshot);
    await writeJson(BASELINES_FILE, rows);
    return snapshot;
  });
}

export async function getBaseline(id: string): Promise<BaselineSnapshot | null> {
  const rows = await listBaselines();
  return rows.find((row) => row.id === id) || null;
}

export async function latestBaseline(): Promise<BaselineSnapshot | null> {
  const rows = await listBaselines();
  return rows.length ? rows[rows.length - 1] : null;
}
