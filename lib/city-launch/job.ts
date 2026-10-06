/**
 * City Launch batch job model: types, scheduling, retries, rate limiting, concurrency.
 * The server module (lib/factory/city-launch.ts) persists these in the factory store and runs ticks.
 *
 * Pure + erasable TypeScript (clock/sleep injected) so `node --test` can import it.
 */
import type { CityPageContent, CityPromptSettings } from "./prompts";

export type CityItemStatus = "queued" | "generating" | "drafted" | "failed" | "cancelled";

export type BatchItem = {
  slug: string;
  name: string;
  state: string;
  stateName: string;
  county: string;
  population: number;
  lat: number | null;
  lng: number | null;
  distanceMiles?: number;
  source: "dataset" | "csv";
  keyword?: string;
  notes?: string;
  status: CityItemStatus;
  attempts: number;
  lastError?: string;
  errorKind?: string;
  nextAttemptAt?: string;
  startedAt?: string;
  finishedAt?: string;
  words?: number;
};

export type BatchStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_errors"
  | "cancelled"
  | "blocked_missing_key";

export type BatchSettings = CityPromptSettings & {
  concurrency: number;
  requestsPerMinute: number;
  maxAttempts: number;
};

export type CityLaunchBatch = {
  id: string;
  projectId: string;
  createdAt: string;
  createdBy: string;
  status: BatchStatus;
  settings: BatchSettings;
  pick: { mode: "radius" | "top_states" | "csv" | "mixed"; detail: string };
  items: BatchItem[];
  provider: { envKey: string; label: string; model: string } | null;
  lease?: { owner: string; until: string } | null;
  ticks: number;
  lastTickAt?: string;
  lastProgressAt?: string;
  finishedAt?: string;
  log: string[];
};

export type GateResult = {
  status: "pass" | "warn" | "block";
  maxScore: number;
  nearestSlug: string | null;
  reasons: string[];
  checkedAt: string;
};

export type CityPageStatus = "queued" | "generating" | "failed" | "draft" | "approved" | "rejected";

export type CityDraft = {
  slug: string;
  projectId: string;
  batchId: string;
  city: {
    name: string;
    state: string;
    stateName: string;
    county: string;
    population: number;
    lat: number | null;
    lng: number | null;
    source: "dataset" | "csv";
  };
  keyword: string;
  content: CityPageContent;
  status: "draft" | "approved" | "rejected";
  words: number;
  generatedAt: string;
  generations: number;
  model: string;
  providerEnvKey: string;
  editedAt?: string;
  editedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
  gate?: GateResult;
  nearby: Array<{ slug: string; name: string; state: string; distanceMiles: number; direction: string }>;
};

export type CityIndexEntry = {
  slug: string;
  name: string;
  state: string;
  batchId: string;
  status: CityPageStatus;
  title?: string;
  metaDescription?: string;
  words?: number;
  population: number;
  lat: number | null;
  lng: number | null;
  gate?: GateResult;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  lastError?: string;
};

export type CityLaunchIndex = {
  projectId: string;
  updatedAt: string;
  batches: Array<{ id: string; createdAt: string; status: BatchStatus; total: number }>;
  pages: Record<string, CityIndexEntry>;
  gateRunAt?: string;
  production?: {
    status: "not_requested" | "signed_off";
    signedOffBy?: string;
    signedOffAt?: string;
    domain?: string;
    pageCount?: number;
    note?: string;
  };
};

export const MAX_BATCH_CITIES = 500;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_RPM = 40;
export const DEFAULT_MAX_ATTEMPTS = 3;
/** A "generating" item older than this is assumed orphaned by a crashed/timed-out tick and re-queued. */
export const STALE_GENERATING_MS = 4 * 60_000;

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function countItems(items: BatchItem[]) {
  const counts = { total: items.length, queued: 0, generating: 0, drafted: 0, failed: 0, cancelled: 0, retrying: 0 };
  for (const item of items) {
    counts[item.status] += 1;
    if (item.status === "failed" && item.nextAttemptAt) counts.retrying += 1;
  }
  return counts;
}

export function isRunnable(item: BatchItem, nowMs: number, maxAttempts: number): boolean {
  if (item.status === "queued") return true;
  if (item.status === "failed") {
    if (item.attempts >= maxAttempts || !item.nextAttemptAt) return false;
    return Date.parse(item.nextAttemptAt) <= nowMs;
  }
  if (item.status === "generating") {
    return !item.startedAt || nowMs - Date.parse(item.startedAt) > STALE_GENERATING_MS;
  }
  return false;
}

/** Items still able to make progress (now or after a scheduled retry). */
export function hasPendingWork(items: BatchItem[], maxAttempts: number): boolean {
  return items.some(
    (item) =>
      item.status === "queued" ||
      item.status === "generating" ||
      (item.status === "failed" && item.attempts < maxAttempts && Boolean(item.nextAttemptAt))
  );
}

export function nextRetryAtMs(items: BatchItem[], maxAttempts: number): number | null {
  let best: number | null = null;
  for (const item of items) {
    if (item.status !== "failed" || item.attempts >= maxAttempts || !item.nextAttemptAt) continue;
    const at = Date.parse(item.nextAttemptAt);
    if (best === null || at < best) best = at;
  }
  return best;
}

/** Exponential backoff with jitter; honours a provider Retry-After. */
export function retryDelayMs(attempt: number, retryAfterMs?: number, rand: () => number = Math.random): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(120_000, retryAfterMs + Math.floor(rand() * 500));
  const base = Math.min(60_000, 2000 * 2 ** Math.max(0, attempt - 1));
  return base + Math.floor(rand() * 1000);
}

export function finalStatus(items: BatchItem[]): BatchStatus {
  const c = countItems(items);
  if (c.cancelled === c.total) return "cancelled";
  return c.failed > 0 ? "completed_with_errors" : "completed";
}

/** Sliding-window requests-per-minute limiter shared by all workers of one tick. */
export function createRateLimiter(
  requestsPerMinute: number,
  clock: { now: () => number; sleep: (ms: number) => Promise<void> } = {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
) {
  const rpm = Math.max(1, requestsPerMinute);
  const stamps: number[] = [];
  let pausedUntil = 0;
  let chain: Promise<void> = Promise.resolve();
  async function acquireInner(): Promise<void> {
    for (;;) {
      const now = clock.now();
      while (stamps.length && now - stamps[0] >= 60_000) stamps.shift();
      const waitPause = pausedUntil - now;
      const waitWindow = stamps.length >= rpm ? 60_000 - (now - stamps[0]) : 0;
      const wait = Math.max(waitPause, waitWindow);
      if (wait <= 0) {
        stamps.push(now);
        return;
      }
      await clock.sleep(Math.min(wait, 5_000));
    }
  }
  return {
    /** Resolves when a request slot is free. Calls are serialized so ordering is fair. */
    acquire(): Promise<void> {
      const run = chain.then(acquireInner);
      chain = run.catch(() => undefined);
      return run;
    },
    /** Back off every worker (e.g. after a 429 with Retry-After). */
    pause(ms: number) {
      pausedUntil = Math.max(pausedUntil, clock.now() + ms);
    },
    get inWindow() {
      return stamps.length;
    },
  };
}

/**
 * Run `worker` over items pulled from `next()` with at most `concurrency` in flight.
 * Stops pulling new work when `shouldContinue()` is false; always waits for in-flight work.
 */
export async function runPool<T>(
  next: () => T | null,
  concurrency: number,
  worker: (item: T) => Promise<void>,
  shouldContinue: () => boolean
): Promise<number> {
  let processed = 0;
  async function lane(): Promise<void> {
    while (shouldContinue()) {
      const item = next();
      if (item === null) return;
      await worker(item);
      processed += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => lane()));
  return processed;
}
