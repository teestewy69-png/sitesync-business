/**
 * City Launch bay (server side): per-client batches of up to 500 animated city landing pages.
 *
 * Store (same factory document store as the client workspace: Netlify Blobs on Netlify, ./data locally):
 *   factory/clients/<projectId>/city-launch/index              page registry (status, gate, title, coords)
 *   factory/clients/<projectId>/city-launch/batches/<batchId>  job: settings, per-city items, lease, log
 *   factory/clients/<projectId>/city-launch/drafts/<citySlug>  structured page content + metadata
 *
 * Automatic: city picking helpers, queueing, LLM writing (rate-limited, concurrent, retried, resumable ticks
 * chained via after()), quality gate (near-duplicate + substance), preview publishing of approved pages.
 * Manual by design: approving drafts (Tony / operator), production sign-off, the production deploy itself.
 */
import { randomUUID } from "node:crypto";
import { isNetlifyHost, isStoreConflict, readDoc, StoreError, writeDoc } from "@/lib/persistence";
import { findProjectById, type ClientProject } from "@/lib/store";
import {
  citiesWithinMiles,
  findCity,
  getUsCityIndex,
  haversineMiles,
  nearestCities,
  parseCityPaste,
  topCitiesInStates,
  type PickedCity,
  type UsCity,
} from "@/lib/city-launch";
import { evaluateGate } from "@/lib/city-launch/gate";
import {
  clampInt,
  countItems,
  createRateLimiter,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RPM,
  finalStatus,
  hasPendingWork,
  isRunnable,
  MAX_BATCH_CITIES,
  nextRetryAtMs,
  retryDelayMs,
  runPool,
  type BatchItem,
  type BatchSettings,
  type CityDraft,
  type CityIndexEntry,
  type CityLaunchBatch,
  type CityLaunchIndex,
  type GateResult,
} from "@/lib/city-launch/job";
import { chatCompletion, describeLlmProvider, LlmError, resolveLlmProvider } from "@/lib/city-launch/llm";
import {
  clampTargetWords,
  CityContentError,
  contentWordCount,
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_TARGET_WORDS,
  DEFAULT_TITLE_TEMPLATE,
  defaultWebsiteContent,
  parseCityPageReply,
  systemPrompt,
  userPrompt,
  type CityPageContent,
  type CityPromptBusiness,
} from "@/lib/city-launch/prompts";
import { FACTORY_COOKIE, factoryToken, sessionValue } from "./auth";
import { configFromProject } from "./client-config";
import { scheduleAfterResponse } from "./client-automation";

const SAFE_ID = /^[a-z0-9_-]{1,80}$/i;
const SAFE_SLUG = /^[a-z0-9-]{1,80}$/;
const NEARBY_FOR_PROMPT = 6;

/* ------------------------------- keys ------------------------------- */

function assertProjectId(projectId: string) {
  if (!SAFE_ID.test(projectId)) throw new StoreError("write", "Invalid client project id.");
}
export function cityIndexKey(projectId: string) {
  assertProjectId(projectId);
  return `factory/clients/${projectId}/city-launch/index`;
}
export function cityBatchKey(projectId: string, batchId: string) {
  assertProjectId(projectId);
  if (!SAFE_ID.test(batchId)) throw new StoreError("write", "Invalid batch id.");
  return `factory/clients/${projectId}/city-launch/batches/${batchId}`;
}
export function cityDraftKey(projectId: string, slug: string) {
  assertProjectId(projectId);
  if (!SAFE_SLUG.test(slug)) throw new StoreError("write", "Invalid city slug.");
  return `factory/clients/${projectId}/city-launch/drafts/${slug}`;
}

/* ------------------------- conflict-safe updates ------------------------- */

const chains = new Map<string, Promise<unknown>>();

async function updateDoc<T>(key: string, init: () => T | null, mutate: (value: T) => T | void): Promise<T | null> {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(async () => {
    for (let attempt = 1; ; attempt += 1) {
      const doc = await readDoc<T>(key);
      const base = doc ? doc.value : init();
      if (base === null) return null;
      const next = (mutate(base) || base) as T;
      try {
        await writeDoc(key, next, { expectedVersion: doc ? doc.version : null });
        return next;
      } catch (err) {
        if (isStoreConflict(err) && attempt < 30) {
          await new Promise((r) => setTimeout(r, Math.min(25 * attempt, 200) + Math.floor(Math.random() * 50)));
          continue;
        }
        throw err;
      }
    }
  });
  chains.set(key, run.catch(() => undefined));
  return run;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyIndex(projectId: string): CityLaunchIndex {
  return { projectId, updatedAt: nowIso(), batches: [], pages: {}, production: { status: "not_requested" } };
}

export async function readCityIndex(projectId: string): Promise<CityLaunchIndex | null> {
  if (!SAFE_ID.test(projectId)) return null;
  return (await readDoc<CityLaunchIndex>(cityIndexKey(projectId)))?.value || null;
}

export async function readCityBatch(projectId: string, batchId: string): Promise<CityLaunchBatch | null> {
  if (!SAFE_ID.test(projectId) || !SAFE_ID.test(batchId)) return null;
  return (await readDoc<CityLaunchBatch>(cityBatchKey(projectId, batchId)))?.value || null;
}

export async function readCityDraft(projectId: string, slug: string): Promise<CityDraft | null> {
  if (!SAFE_ID.test(projectId) || !SAFE_SLUG.test(slug)) return null;
  return (await readDoc<CityDraft>(cityDraftKey(projectId, slug)))?.value || null;
}

async function updateIndex(projectId: string, mutate: (index: CityLaunchIndex) => void): Promise<CityLaunchIndex> {
  const out = await updateDoc<CityLaunchIndex>(cityIndexKey(projectId), () => emptyIndex(projectId), (index) => {
    index.production = index.production || { status: "not_requested" };
    mutate(index);
    index.updatedAt = nowIso();
  });
  return out as CityLaunchIndex;
}

/* --------------------------- client context --------------------------- */

export type CityLaunchClientContext = {
  projectId: string;
  business: CityPromptBusiness;
  baseCity: UsCity | null;
  contactPath: string;
  designStyleId: string;
  selectedDomain?: string;
};

export function cityLaunchContext(project: ClientProject): CityLaunchClientContext {
  const config = configFromProject(project);
  const index = getUsCityIndex();
  const city = project.city || config.city || "";
  const state = project.state || config.state || "";
  const baseCity = city && state ? findCity(index, city, state) : null;
  const pages = project.seededPages?.length ? project.seededPages : config.seededPages;
  const contact = pages.find((p) => p.slug === "contact");
  return {
    projectId: project.id,
    business: {
      businessName: project.businessName || config.businessName,
      niche: project.niche || config.niche,
      phone: project.phone || config.phone || "",
      baseCity: baseCity?.name || city,
      baseState: baseCity?.state || state,
      primaryGoal: project.primaryGoal || config.primaryGoal || "",
      notes: project.notes || config.notes || "",
    },
    baseCity,
    contactPath: contact ? `/demo/client/${project.id}/contact` : `/demo/client/${project.id}`,
    designStyleId: project.designStyleId || config.designStyleId,
    selectedDomain: project.selectedDomain,
  };
}

/* ------------------------------ picking ------------------------------ */

export type CityPickRequest = {
  mode: "radius" | "top_states" | "csv";
  /** radius: origin city (defaults to the client's city) */
  originCity?: string;
  originState?: string;
  miles?: number;
  /** top_states: state abbreviations or names */
  states?: string[];
  limit?: number;
  minPopulation?: number;
  csv?: string;
  includeOrigin?: boolean;
};

export type CityPickResult = {
  ok: boolean;
  error?: string;
  cities: PickedCity[];
  origin?: { name: string; state: string; lat: number; lng: number } | null;
  issues: Array<{ row: number; input: string; message: string }>;
  detail: string;
};

export function pickCities(project: ClientProject, req: CityPickRequest): CityPickResult {
  const index = getUsCityIndex();
  const ctx = cityLaunchContext(project);
  const limit = clampInt(req.limit, 1, MAX_BATCH_CITIES, 50);
  const minPopulation = clampInt(req.minPopulation, 0, 10_000_000, 0);
  if (req.mode === "radius") {
    const origin =
      req.originCity && req.originState ? findCity(index, req.originCity, req.originState) : ctx.baseCity;
    if (!origin) {
      return {
        ok: false,
        error: req.originCity
          ? `"${req.originCity}, ${req.originState}" is not in the Census city dataset. Try the nearest incorporated city.`
          : "Client city/state is missing or not in the Census dataset. Enter an origin city.",
        cities: [],
        issues: [],
        detail: "",
      };
    }
    const miles = clampInt(req.miles, 1, 500, 30);
    const cities = citiesWithinMiles(index, origin, miles, limit, {
      minPopulation,
      includeOrigin: req.includeOrigin !== false,
      originSlug: origin.slug,
    });
    if (req.includeOrigin !== false && !cities.some((c) => c.slug === origin.slug)) {
      cities.unshift({ ...origin, distanceMiles: 0, source: "dataset" });
      if (cities.length > limit) cities.pop();
    }
    return {
      ok: true,
      cities,
      origin: { name: origin.name, state: origin.state, lat: origin.lat, lng: origin.lng },
      issues: [],
      detail: `Within ${miles} mi of ${origin.name}, ${origin.state}${minPopulation ? `, pop >= ${minPopulation}` : ""}, top ${limit} by population`,
    };
  }
  if (req.mode === "top_states") {
    const states = (req.states || []).map((s) => s.trim()).filter(Boolean);
    if (!states.length) return { ok: false, error: "Enter at least one state.", cities: [], issues: [], detail: "" };
    const cities = topCitiesInStates(index, states, limit, { minPopulation });
    withDistanceFromBase(cities, ctx.baseCity);
    return { ok: true, cities, issues: [], detail: `Top ${limit} cities by population in ${states.join(", ").toUpperCase()}`, origin: null };
  }
  const parsed = parseCityPaste(index, req.csv || "");
  withDistanceFromBase(parsed.cities, ctx.baseCity);
  return {
    ok: parsed.cities.length > 0,
    error: parsed.cities.length ? undefined : "No usable rows in the paste.",
    cities: parsed.cities,
    issues: parsed.issues,
    detail: `CSV paste: ${parsed.cities.length} cities${parsed.duplicates ? `, ${parsed.duplicates} duplicates dropped` : ""}${parsed.truncated ? `, ${parsed.truncated} over the 500 cap dropped` : ""}`,
    origin: null,
  };
}

function withDistanceFromBase(cities: PickedCity[], base: UsCity | null) {
  if (!base) return;
  for (const c of cities) {
    if (Number.isFinite(c.lat)) c.distanceMiles = Math.round(haversineMiles(base, c) * 10) / 10;
  }
}

/* ------------------------------ queueing ------------------------------ */

export type QueueBatchInput = {
  cities: Array<Partial<PickedCity> & { name: string; state: string }>;
  keyword?: string;
  titleTemplate?: string;
  promptTemplate?: string;
  competitorGaps?: string;
  websiteContent?: string;
  targetWordCount?: number;
  includeFaq?: boolean;
  concurrency?: number;
  requestsPerMinute?: number;
  pickDetail?: string;
  pickMode?: CityLaunchBatch["pick"]["mode"];
  /** Regenerate pages that are already approved (off by default: approved pages are left alone). */
  includeApproved?: boolean;
};

export type QueueBatchResult = {
  ok: boolean;
  error?: string;
  batch?: CityLaunchBatch;
  skipped?: Array<{ slug: string; reason: string }>;
};

function envInt(name: string, fallback: number) {
  const n = Number((process.env[name] || "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function cityLaunchProviderStatus() {
  return describeLlmProvider(process.env);
}

/** Resolve dataset rows server-side (never trust client-sent coordinates/population). */
function resolveCityRows(input: QueueBatchInput["cities"]): { items: BatchItem[]; issues: string[] } {
  const index = getUsCityIndex();
  const items: BatchItem[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const row of input) {
    const name = String(row.name || "").trim();
    const state = String(row.state || "").trim();
    if (!name || !state) continue;
    const match = findCity(index, name, state);
    const slug = match ? match.slug : String(row.slug || "").trim();
    if (!match && (!SAFE_SLUG.test(slug) || !index.states.has(state.toUpperCase()))) {
      issues.push(`${name}, ${state}: not a known U.S. city/state.`);
      continue;
    }
    if (seen.has(slug)) continue;
    seen.add(slug);
    items.push({
      slug,
      name: match ? match.name : name.slice(0, 80),
      state: match ? match.state : state.toUpperCase(),
      stateName: match ? match.stateName : index.states.get(state.toUpperCase()) || state,
      county: match?.county || "",
      population: match?.population || 0,
      lat: match ? match.lat : null,
      lng: match ? match.lng : null,
      distanceMiles: typeof row.distanceMiles === "number" ? row.distanceMiles : undefined,
      source: match ? "dataset" : "csv",
      keyword: row.keyword ? String(row.keyword).slice(0, 120) : undefined,
      notes: row.notes ? String(row.notes).slice(0, 600) : undefined,
      status: "queued",
      attempts: 0,
    });
  }
  return { items, issues };
}

export async function queueCityLaunchBatch(
  projectId: string,
  input: QueueBatchInput,
  actor: string,
  opts: { hostOrigin?: string | null; autoStart?: boolean } = {}
): Promise<QueueBatchResult> {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false, error: "Client project not found." };
  const provider = cityLaunchProviderStatus();
  if (!provider.configured) return { ok: false, error: provider.detail };
  if (!Array.isArray(input.cities) || !input.cities.length) return { ok: false, error: "Pick at least one city." };
  if (input.cities.length > MAX_BATCH_CITIES) {
    return { ok: false, error: `A batch is capped at ${MAX_BATCH_CITIES} cities (got ${input.cities.length}).` };
  }
  const ctx = cityLaunchContext(project);
  const { items, issues } = resolveCityRows(input.cities);
  const index = (await readCityIndex(projectId)) || emptyIndex(projectId);
  const skipped: Array<{ slug: string; reason: string }> = issues.map((i) => ({ slug: "-", reason: i }));
  const runnable = items.filter((item) => {
    const existing = index.pages[item.slug];
    if (existing?.status === "approved" && !input.includeApproved) {
      skipped.push({ slug: item.slug, reason: "already approved (left untouched)" });
      return false;
    }
    if (existing && (existing.status === "queued" || existing.status === "generating")) {
      const other = index.batches.find((b) => b.id === existing.batchId);
      if (other && (other.status === "running" || other.status === "queued" || other.status === "paused")) {
        skipped.push({ slug: item.slug, reason: `already in batch ${existing.batchId}` });
        return false;
      }
    }
    return true;
  });
  if (!runnable.length) return { ok: false, error: "Every picked city is already approved or in another active batch.", skipped };

  const settings: BatchSettings = {
    keyword: (input.keyword || ctx.business.niche || "").trim().slice(0, 120),
    titleTemplate: (input.titleTemplate || DEFAULT_TITLE_TEMPLATE).slice(0, 200),
    promptTemplate: (input.promptTemplate || DEFAULT_PROMPT_TEMPLATE).slice(0, 2000),
    competitorGaps: (input.competitorGaps || "").slice(0, 2000),
    websiteContent: (input.websiteContent || defaultWebsiteContent(ctx.business)).slice(0, 3000),
    targetWordCount: clampTargetWords(input.targetWordCount ?? DEFAULT_TARGET_WORDS),
    includeFaq: input.includeFaq !== false,
    concurrency: clampInt(input.concurrency, 1, 8, envInt("CITY_LAUNCH_CONCURRENCY", DEFAULT_CONCURRENCY)),
    requestsPerMinute: clampInt(input.requestsPerMinute, 1, 600, envInt("CITY_LAUNCH_RPM", DEFAULT_RPM)),
    maxAttempts: envInt("CITY_LAUNCH_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS),
  };
  if (!settings.keyword) return { ok: false, error: "Keyword is required (client niche is empty)." };

  const batchId = `clb_${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
  const batch: CityLaunchBatch = {
    id: batchId,
    projectId,
    createdAt: nowIso(),
    createdBy: actor || "operator",
    status: "queued",
    settings,
    pick: { mode: input.pickMode || "mixed", detail: (input.pickDetail || "").slice(0, 300) },
    items: runnable,
    provider: { envKey: provider.envKey, label: provider.label, model: provider.model },
    lease: null,
    ticks: 0,
    log: [`${nowIso()} queued ${runnable.length} cities by ${actor || "operator"} (${provider.label}, ${provider.model})`],
  };
  await writeDoc(cityBatchKey(projectId, batchId), batch, { expectedVersion: null });
  await updateIndex(projectId, (idx) => {
    idx.batches = [{ id: batchId, createdAt: batch.createdAt, status: "queued" as const, total: runnable.length }, ...idx.batches].slice(0, 50);
    for (const item of runnable) {
      const prev = idx.pages[item.slug];
      idx.pages[item.slug] = {
        ...(prev || {}),
        slug: item.slug,
        name: item.name,
        state: item.state,
        batchId,
        status: "queued",
        population: item.population,
        lat: item.lat,
        lng: item.lng,
        updatedAt: nowIso(),
        lastError: undefined,
      } as CityIndexEntry;
    }
  });
  if (opts.autoStart !== false) queueCityLaunchTick(projectId, batchId, opts.hostOrigin);
  return { ok: true, batch, skipped };
}

/* ------------------------------- writing ------------------------------- */

function promptCity(item: BatchItem) {
  return {
    name: item.name,
    state: item.state,
    stateName: item.stateName,
    county: item.county,
    population: item.population,
    keyword: item.keyword,
    notes: item.notes,
  };
}

function nearbyFor(item: BatchItem) {
  if (item.lat === null || item.lng === null) return [];
  const index = getUsCityIndex();
  const origin = { slug: item.slug, lat: item.lat, lng: item.lng };
  const around = citiesWithinMiles(index, origin, 60, 60, { originSlug: item.slug });
  return nearestCities(origin, around.length >= NEARBY_FOR_PROMPT ? around : index.all, NEARBY_FOR_PROMPT).map((c) => ({
    slug: c.slug,
    name: c.name,
    state: c.state,
    distanceMiles: c.distanceMiles,
    direction: c.direction,
    population: c.population,
  }));
}

export async function writeCityContent(
  ctx: CityLaunchClientContext,
  item: BatchItem,
  settings: BatchSettings
): Promise<{ content: CityPageContent; model: string; envKey: string; nearby: CityDraft["nearby"] }> {
  const resolved = resolveLlmProvider(process.env);
  if (!resolved) throw new LlmError("missing_key", "No LLM key configured for City Launch.");
  const nearby = nearbyFor(item);
  const base = ctx.baseCity;
  const fromBase =
    base && item.lat !== null && item.lng !== null
      ? nearestCities({ slug: "__base__", lat: base.lat, lng: base.lng }, [{ slug: item.slug, lat: item.lat, lng: item.lng }], 1)[0]
      : null;
  const city = promptCity(item);
  const messages = [
    { role: "system" as const, content: systemPrompt(settings, city) },
    {
      role: "user" as const,
      content: userPrompt(settings, city, ctx.business, nearby, fromBase ? { distanceMiles: fromBase.distanceMiles, direction: fromBase.direction } : null),
    },
  ];
  const reply = await chatCompletion(resolved, messages, {
    timeoutMs: envInt("CITY_LAUNCH_LLM_TIMEOUT_MS", 90_000),
    temperature: 0.7,
    maxTokens: Math.min(4000, Math.round(settings.targetWordCount * 2.6) + 600),
    jsonMode: true,
  });
  let content: CityPageContent;
  try {
    content = parseCityPageReply(reply.content, settings, city);
  } catch (err) {
    if (err instanceof CityContentError) throw new LlmError("bad_response", err.message);
    throw err;
  }
  if (ctx.business.businessName && content.title.length + ctx.business.businessName.length + 3 <= 65) {
    content.title = `${content.title} | ${ctx.business.businessName}`;
  }
  return {
    content,
    model: reply.model,
    envKey: resolved.provider.envKey,
    nearby: nearby.map(({ slug, name, state, distanceMiles, direction }) => ({ slug, name, state, distanceMiles, direction })),
  };
}

function draftFrom(
  projectId: string,
  batchId: string,
  item: BatchItem,
  keyword: string,
  written: Awaited<ReturnType<typeof writeCityContent>>,
  previous: CityDraft | null
): CityDraft {
  return {
    slug: item.slug,
    projectId,
    batchId,
    city: {
      name: item.name,
      state: item.state,
      stateName: item.stateName,
      county: item.county,
      population: item.population,
      lat: item.lat,
      lng: item.lng,
      source: item.source,
    },
    keyword,
    content: written.content,
    status: "draft",
    words: contentWordCount(written.content),
    generatedAt: nowIso(),
    generations: (previous?.generations || 0) + 1,
    model: written.model,
    providerEnvKey: written.envKey,
    nearby: written.nearby,
  };
}

/* ------------------------------- ticks ------------------------------- */

export type TickResult = {
  ok: boolean;
  status: string;
  processed: number;
  drafted: number;
  failed: number;
  remaining: number;
  continued: "chained" | "local-loop" | "none" | "needs-poll";
  detail?: string;
};

function tickBudgetMs(): number {
  const env = Number((process.env.CITY_LAUNCH_TICK_BUDGET_MS || "").trim());
  if (Number.isFinite(env) && env > 0) return env;
  // Netlify synchronous functions stop at ~26s (after() shares that window). Locally there is no limit.
  return isNetlifyHost() ? 18_000 : 0;
}

/**
 * Run one tick of a batch: take the lease, write as many cities as the time budget allows
 * (concurrency + RPM limited, retries with backoff), persist progress continuously, release the lease.
 * Safe to call concurrently (lease) and repeatedly (resume after crash / timeout / restart).
 */
export async function runCityLaunchTick(
  projectId: string,
  batchId: string,
  opts: { budgetMs?: number; hostOrigin?: string | null } = {}
): Promise<TickResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? tickBudgetMs();
  const owner = randomUUID();
  const key = cityBatchKey(projectId, batchId);
  const none = (status: string, detail?: string): TickResult => ({ ok: true, status, processed: 0, drafted: 0, failed: 0, remaining: 0, continued: "none", detail });

  const project = await findProjectById(projectId);
  if (!project) return { ...none("missing"), ok: false, detail: "Client project not found." };
  const ctx = cityLaunchContext(project);
  const provider = cityLaunchProviderStatus();

  // 1) Lease.
  let leaseBusy = false;
  let batch = await updateDoc<CityLaunchBatch>(key, () => null, (b) => {
    if (b.status !== "queued" && b.status !== "running" && b.status !== "blocked_missing_key") return;
    if (b.lease && Date.parse(b.lease.until) > Date.now() && b.lease.owner !== owner) {
      leaseBusy = true;
      return;
    }
    if (!provider.configured) {
      b.status = "blocked_missing_key";
      b.log = [...b.log, `${nowIso()} blocked: ${provider.detail}`].slice(-40);
      return;
    }
    b.status = "running";
    b.lease = { owner, until: new Date(Date.now() + (budget || 15 * 60_000) + 120_000).toISOString() };
    b.ticks += 1;
    b.lastTickAt = nowIso();
  });
  if (!batch) return { ...none("missing"), ok: false, detail: "Batch not found." };
  if (leaseBusy) return none(batch.status, "Another tick holds the lease.");
  if (batch.status !== "running" || batch.lease?.owner !== owner) {
    return none(batch.status, !provider.configured ? provider.detail : `Batch is ${batch.status}.`);
  }

  const settings = batch.settings;
  const items = new Map(batch.items.map((i) => [i.slug, { ...i }]));
  const touched = new Set<string>();
  const draftTitles = new Map<string, string>();
  const draftMetas = new Map<string, string>();
  let stop = false;
  let stopReason = "";
  let drafted = 0;
  let failed = 0;
  let avgCallMs = 15_000;
  const limiter = createRateLimiter(settings.requestsPerMinute);
  const logLines: string[] = [];

  // Coalesced flush of item progress + index entries (keeps Blobs writes to ~1 per 3s).
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    flushing = flushing.then(async () => {
      if (!touched.size && !logLines.length) return;
      const slugs = [...touched];
      touched.clear();
      const lines = logLines.splice(0);
      const updated = await updateDoc<CityLaunchBatch>(key, () => null, (b) => {
        if (b.status === "paused" || b.status === "cancelled") {
          stop = true;
          stopReason = `operator ${b.status} the batch`;
        }
        const patch = new Map(slugs.map((s) => [s, items.get(s)!]));
        b.items = b.items.map((i) => patch.get(i.slug) || i);
        b.lastProgressAt = nowIso();
        if (lines.length) b.log = [...b.log, ...lines].slice(-40);
        if (b.lease?.owner === owner) b.lease.until = new Date(Date.now() + (budget || 15 * 60_000) + 120_000).toISOString();
      });
      if (updated) batch = updated;
      await updateIndex(projectId, (idx) => {
        for (const slug of slugs) {
          const item = items.get(slug)!;
          const prev = idx.pages[slug];
          if (prev && prev.batchId !== batchId) continue;
          const status = item.status === "drafted" ? "draft" : item.status === "cancelled" ? "failed" : item.status;
          idx.pages[slug] = {
            ...(prev || ({} as CityIndexEntry)),
            slug,
            name: item.name,
            state: item.state,
            batchId,
            status,
            population: item.population,
            lat: item.lat,
            lng: item.lng,
            words: item.words ?? prev?.words,
            title: item.status === "drafted" ? draftTitles.get(slug) || prev?.title : prev?.title,
            metaDescription: item.status === "drafted" ? draftMetas.get(slug) || prev?.metaDescription : prev?.metaDescription,
            lastError: item.status === "failed" ? item.lastError : undefined,
            approvedAt: item.status === "drafted" ? undefined : prev?.approvedAt,
            approvedBy: item.status === "drafted" ? undefined : prev?.approvedBy,
            gate: item.status === "drafted" ? undefined : prev?.gate,
            updatedAt: nowIso(),
          };
        }
      });
    });
    return flushing;
  };
  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush().catch((err) => console.error("[city-launch] flush failed:", err instanceof Error ? err.message : err));
    }, 2500);
  };
  const timeLeft = () => (budget ? budget - (Date.now() - started) : Number.POSITIVE_INFINITY);
  const next = (): BatchItem | null => {
    if (stop) return null;
    // Do not start a call that cannot finish inside this tick's budget.
    if (budget && timeLeft() < Math.min(avgCallMs * 1.15, budget * 0.9)) return null;
    const now = Date.now();
    for (const item of items.values()) {
      if (isRunnable(item, now, settings.maxAttempts)) {
        item.status = "generating";
        item.startedAt = nowIso();
        touched.add(item.slug);
        return item;
      }
    }
    return null;
  };

  const worker = async (item: BatchItem) => {
    await limiter.acquire();
    if (stop) {
      item.status = "queued";
      touched.add(item.slug);
      return;
    }
    const t0 = Date.now();
    try {
      const written = await writeCityContent(ctx, item, settings);
      const previous = await readCityDraft(projectId, item.slug);
      const draft = draftFrom(projectId, batchId, item, item.keyword || settings.keyword, written, previous);
      await writeDoc(cityDraftKey(projectId, item.slug), draft);
      item.status = "drafted";
      item.words = draft.words;
      item.finishedAt = nowIso();
      item.lastError = undefined;
      item.errorKind = undefined;
      item.nextAttemptAt = undefined;
      item.attempts += 1;
      draftTitles.set(item.slug, draft.content.title);
      draftMetas.set(item.slug, draft.content.metaDescription);
      drafted += 1;
    } catch (err) {
      item.attempts += 1;
      const llm = err instanceof LlmError ? err : null;
      item.lastError = (err instanceof Error ? err.message : "Write failed").slice(0, 300);
      item.errorKind = llm?.kind || "error";
      item.status = "failed";
      if (llm && (llm.kind === "auth" || llm.kind === "missing_key")) {
        stop = true;
        stopReason = `provider rejected the request: ${item.lastError}`;
        item.attempts -= 1; // not the city's fault - keep its retries
        item.nextAttemptAt = new Date(Date.now() + 60_000).toISOString();
      } else if ((llm?.retryable ?? true) && item.attempts < settings.maxAttempts) {
        const delay = retryDelayMs(item.attempts, llm?.retryAfterMs);
        item.nextAttemptAt = new Date(Date.now() + delay).toISOString();
        if (llm?.kind === "rate_limit") limiter.pause(delay);
      } else {
        item.nextAttemptAt = undefined;
        failed += 1;
      }
      logLines.push(`${nowIso()} ${item.slug}: ${item.errorKind} (attempt ${item.attempts}/${settings.maxAttempts}) ${item.lastError.slice(0, 140)}`);
    } finally {
      avgCallMs = Math.round(avgCallMs * 0.7 + (Date.now() - t0) * 0.3);
      touched.add(item.slug);
      scheduleFlush();
    }
  };

  let processed = 0;
  // A tick keeps looping while retries are due inside its budget (local runs have no budget).
  for (;;) {
    processed += await runPool(next, settings.concurrency, worker, () => !stop);
    if (stop) break;
    const pending = hasPendingWork([...items.values()], settings.maxAttempts);
    if (!pending) break;
    const retryAt = nextRetryAtMs([...items.values()], settings.maxAttempts);
    const anyQueued = [...items.values()].some((i) => isRunnable(i, Date.now(), settings.maxAttempts));
    if (anyQueued && (!budget || timeLeft() > avgCallMs * 1.15)) continue;
    if (retryAt && (!budget || retryAt - Date.now() + avgCallMs * 1.15 < timeLeft())) {
      await new Promise((r) => setTimeout(r, Math.max(0, retryAt - Date.now()) + 50));
      continue;
    }
    break;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (stopReason) logLines.push(`${nowIso()} stopped: ${stopReason}`);
  await flush();

  const all = [...items.values()];
  const pending = hasPendingWork(all, settings.maxAttempts);
  const finished = !pending && !stop;
  const providerStop = stopReason.startsWith("provider");
  batch = (await updateDoc<CityLaunchBatch>(key, () => null, (b) => {
    if (b.lease?.owner === owner) b.lease = null;
    if (finished && (b.status === "running" || b.status === "queued")) {
      b.status = finalStatus(all);
      b.finishedAt = nowIso();
      b.log = [...b.log, `${nowIso()} finished: ${countItems(all).drafted} drafted, ${countItems(all).failed} failed`].slice(-40);
    } else if (providerStop && b.status === "running") {
      b.status = "paused";
    }
  })) || batch;
  await updateIndex(projectId, (idx) => {
    idx.batches = idx.batches.map((b) => (b.id === batchId ? { ...b, status: batch!.status } : b));
  });

  if (finished || drafted > 0) {
    try {
      await runCityGate(projectId);
    } catch (err) {
      console.error("[city-launch] gate failed:", err instanceof Error ? err.message : err);
    }
  }
  if (finished) await noteBatchOnWorkspace(projectId, batch!).catch(() => undefined);

  let continued: TickResult["continued"] = "none";
  if (pending && !stop && batch!.status === "running") {
    continued = await continueTick(projectId, batchId, opts.hostOrigin);
  }
  const counts = countItems(all);
  return {
    ok: true,
    status: batch!.status,
    processed,
    drafted,
    failed,
    remaining: counts.queued + counts.generating + counts.retrying,
    continued,
    detail: stopReason || undefined,
  };
}

/** Origins we will send the factory session cookie to (never a client-supplied Host). */
function trustedSelfOrigin(hint?: string | null): string | null {
  const envs = [process.env.DEPLOY_PRIME_URL, process.env.URL, process.env.NEXT_PUBLIC_SITE_URL]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .map((v) => {
      try {
        return new URL(v).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  if (hint) {
    try {
      const url = new URL(hint);
      if (envs.includes(url.origin) || ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
    } catch {
      /* ignore */
    }
  }
  return envs[0] || null;
}

async function continueTick(projectId: string, batchId: string, hint?: string | null): Promise<TickResult["continued"]> {
  if (!tickBudgetMs()) {
    // Unlimited local tick stopped only because retries are scheduled later: loop in-process.
    queueCityLaunchTick(projectId, batchId, hint, 1500);
    return "local-loop";
  }
  const origin = trustedSelfOrigin(hint);
  const token = factoryToken();
  if (!origin || !token) return "needs-poll";
  try {
    const cookie = `${FACTORY_COOKIE}=${await sessionValue(token)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${origin}/api/factory/city-launch/tick`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ projectId, batchId, chained: true }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok ? "chained" : "needs-poll";
  } catch {
    return "needs-poll";
  }
}

/** Run a tick after the HTTP response (Next after()); falls back to fire-and-forget outside a request. */
export function queueCityLaunchTick(projectId: string, batchId: string, hostOrigin?: string | null, delayMs = 0): void {
  scheduleAfterResponse(`city-launch:${projectId}:${batchId}`, async () => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    const result = await runCityLaunchTick(projectId, batchId, { hostOrigin });
    if (!result.ok) console.warn(`[city-launch] tick ${batchId}: ${result.detail}`);
  });
}

/* ----------------------------- quality gate ----------------------------- */

async function readDrafts(projectId: string, slugs: string[]): Promise<CityDraft[]> {
  const out: CityDraft[] = [];
  for (let i = 0; i < slugs.length; i += 25) {
    const chunk = await Promise.all(slugs.slice(i, i + 25).map((s) => readCityDraft(projectId, s)));
    for (const d of chunk) if (d) out.push(d);
  }
  return out;
}

/**
 * Recompute the gate for every live page of a client. Approved pages are compared only with other approved
 * pages (a newer draft that copies an approved page is the one that gets blocked); drafts are compared with all.
 */
export async function runCityGate(projectId: string): Promise<{ checked: number; blocked: number; warned: number }> {
  const index = await readCityIndex(projectId);
  if (!index) return { checked: 0, blocked: 0, warned: 0 };
  const project = await findProjectById(projectId);
  const baseCity = project ? cityLaunchContext(project).business.baseCity : undefined;
  const liveSlugs = Object.values(index.pages)
    .filter((p) => p.status === "draft" || p.status === "approved")
    .map((p) => p.slug);
  const drafts = await readDrafts(projectId, liveSlugs);
  const approved = drafts.filter((d) => d.status === "approved");
  const now = nowIso();
  const approvedGate = evaluateGate(approved, { baseCity, now });
  const allGate = evaluateGate(drafts, { baseCity, now });
  const result = new Map<string, GateResult>();
  for (const d of drafts) result.set(d.slug, d.status === "approved" ? approvedGate.get(d.slug)! : allGate.get(d.slug)!);
  let blocked = 0;
  let warned = 0;
  await updateIndex(projectId, (idx) => {
    for (const [slug, gate] of result) {
      if (!idx.pages[slug]) continue;
      idx.pages[slug].gate = gate;
      if (gate.status === "block") blocked += 1;
      if (gate.status === "warn") warned += 1;
    }
    idx.gateRunAt = now;
  });
  return { checked: result.size, blocked, warned };
}

/* ---------------------------- review actions ---------------------------- */

export type DraftEdit = Partial<Pick<CityPageContent, "title" | "metaDescription" | "h1" | "heroSubhead" | "intro" | "ctaHeadline" | "ctaText">> & {
  sections?: CityPageContent["sections"];
  localHighlights?: string[];
  faq?: CityPageContent["faq"];
};

export async function saveCityDraftEdit(projectId: string, slug: string, edit: DraftEdit, actor: string) {
  const key = cityDraftKey(projectId, slug);
  const updated = await updateDoc<CityDraft>(key, () => null, (draft) => {
    const c = draft.content;
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
    draft.content = {
      ...c,
      title: s(edit.title, 120) ?? c.title,
      metaDescription: s(edit.metaDescription, 200) ?? c.metaDescription,
      h1: s(edit.h1, 160) ?? c.h1,
      heroSubhead: s(edit.heroSubhead, 400) ?? c.heroSubhead,
      intro: s(edit.intro, 2000) ?? c.intro,
      ctaHeadline: s(edit.ctaHeadline, 160) ?? c.ctaHeadline,
      ctaText: s(edit.ctaText, 600) ?? c.ctaText,
      sections: Array.isArray(edit.sections) ? edit.sections.filter((x) => x.heading && x.body).slice(0, 10) : c.sections,
      localHighlights: Array.isArray(edit.localHighlights) ? edit.localHighlights.filter(Boolean).slice(0, 8) : c.localHighlights,
      faq: Array.isArray(edit.faq) ? edit.faq.filter((x) => x.question && x.answer).slice(0, 8) : c.faq,
    };
    draft.words = contentWordCount(draft.content);
    draft.editedAt = nowIso();
    draft.editedBy = actor || "operator";
    if (draft.status === "approved") {
      draft.status = "draft"; // edited copy needs a fresh approval
      draft.approvedAt = undefined;
      draft.approvedBy = undefined;
    }
  });
  if (!updated) return { ok: false as const, error: "Draft not found." };
  await updateIndex(projectId, (idx) => {
    const p = idx.pages[slug];
    if (!p) return;
    p.status = "draft";
    p.title = updated.content.title;
    p.metaDescription = updated.content.metaDescription;
    p.words = updated.words;
    p.approvedAt = undefined;
    p.approvedBy = undefined;
    p.updatedAt = nowIso();
  });
  await runCityGate(projectId);
  return { ok: true as const, draft: updated };
}

export async function regenerateCityDraft(projectId: string, slug: string, actor: string) {
  const project = await findProjectById(projectId);
  if (!project) return { ok: false as const, error: "Client project not found." };
  const provider = cityLaunchProviderStatus();
  if (!provider.configured) return { ok: false as const, error: provider.detail };
  const index = await readCityIndex(projectId);
  const entry = index?.pages[slug];
  if (!entry) return { ok: false as const, error: "Unknown city page." };
  const batch = await readCityBatch(projectId, entry.batchId);
  if (!batch) return { ok: false as const, error: "Batch settings not found." };
  const item = batch.items.find((i) => i.slug === slug);
  if (!item) return { ok: false as const, error: "City not in its batch." };
  const ctx = cityLaunchContext(project);
  try {
    const written = await writeCityContent(ctx, item, batch.settings);
    const previous = await readCityDraft(projectId, slug);
    const draft = draftFrom(projectId, batch.id, item, item.keyword || batch.settings.keyword, written, previous);
    await writeDoc(cityDraftKey(projectId, slug), draft);
    await updateIndex(projectId, (idx) => {
      const p = idx.pages[slug];
      if (!p) return;
      Object.assign(p, {
        status: "draft",
        title: draft.content.title,
        metaDescription: draft.content.metaDescription,
        words: draft.words,
        approvedAt: undefined,
        approvedBy: undefined,
        lastError: undefined,
        updatedAt: nowIso(),
      });
    });
    await updateDoc<CityLaunchBatch>(cityBatchKey(projectId, batch.id), () => null, (b) => {
      b.items = b.items.map((i) => (i.slug === slug ? { ...i, status: "drafted", words: draft.words, lastError: undefined, nextAttemptAt: undefined, finishedAt: nowIso() } : i));
      b.log = [...b.log, `${nowIso()} ${slug}: regenerated by ${actor || "operator"}`].slice(-40);
    });
    await runCityGate(projectId);
    return { ok: true as const, draft };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Regenerate failed.";
    return { ok: false as const, error: message };
  }
}

export async function approveCityDrafts(projectId: string, slugs: string[], actor: string, opts: { allowWarn?: boolean } = {}) {
  const who = (actor || "").trim();
  if (!who) return { ok: false as const, error: "approvedBy required (human sign-off)." };
  await runCityGate(projectId);
  const index = await readCityIndex(projectId);
  if (!index) return { ok: false as const, error: "No City Launch pages yet." };
  const approved: string[] = [];
  const refused: Array<{ slug: string; reason: string }> = [];
  for (const slug of slugs) {
    const p = index.pages[slug];
    if (!p) {
      refused.push({ slug, reason: "unknown page" });
      continue;
    }
    if (p.status !== "draft" && p.status !== "approved") {
      refused.push({ slug, reason: `status ${p.status}` });
      continue;
    }
    if (!p.gate || p.gate.status === "block") {
      refused.push({ slug, reason: p.gate ? `quality gate: ${p.gate.reasons.join(" ")}` : "quality gate not run" });
      continue;
    }
    if (p.gate.status === "warn" && opts.allowWarn === false) {
      refused.push({ slug, reason: `gate warning: ${p.gate.reasons.join(" ")}` });
      continue;
    }
    const ok = await updateDoc<CityDraft>(cityDraftKey(projectId, slug), () => null, (d) => {
      d.status = "approved";
      d.approvedAt = nowIso();
      d.approvedBy = who;
    });
    if (ok) approved.push(slug);
    else refused.push({ slug, reason: "draft missing" });
  }
  const at = nowIso();
  await updateIndex(projectId, (idx) => {
    for (const slug of approved) {
      const p = idx.pages[slug];
      if (!p) continue;
      p.status = "approved";
      p.approvedAt = at;
      p.approvedBy = who;
      p.updatedAt = at;
    }
  });
  if (approved.length) await runCityGate(projectId);
  return { ok: true as const, approved, refused };
}

export async function setCityDraftStatus(projectId: string, slug: string, status: "draft" | "rejected", actor: string, reason = "") {
  const updated = await updateDoc<CityDraft>(cityDraftKey(projectId, slug), () => null, (d) => {
    d.status = status;
    d.approvedAt = undefined;
    d.approvedBy = undefined;
    d.rejectedReason = status === "rejected" ? reason.slice(0, 300) || `rejected by ${actor || "operator"}` : undefined;
  });
  if (!updated) return { ok: false as const, error: "Draft not found." };
  await updateIndex(projectId, (idx) => {
    const p = idx.pages[slug];
    if (!p) return;
    p.status = status;
    p.approvedAt = undefined;
    p.approvedBy = undefined;
    p.updatedAt = nowIso();
  });
  await runCityGate(projectId);
  return { ok: true as const };
}

/* ---------------------------- batch controls ---------------------------- */

export async function controlCityBatch(
  projectId: string,
  batchId: string,
  action: "pause" | "resume" | "cancel" | "retry_failed",
  actor: string,
  hostOrigin?: string | null
) {
  const key = cityBatchKey(projectId, batchId);
  let error = "";
  const updated = await updateDoc<CityLaunchBatch>(key, () => null, (b) => {
    const stamp = `${nowIso()} ${action} by ${actor || "operator"}`;
    if (action === "pause") {
      if (b.status !== "running" && b.status !== "queued") error = `Cannot pause a ${b.status} batch.`;
      else b.status = "paused";
    } else if (action === "resume") {
      if (!["paused", "blocked_missing_key", "running", "queued"].includes(b.status)) error = `Cannot resume a ${b.status} batch.`;
      else {
        b.status = "running";
        if (b.lease && Date.parse(b.lease.until) < Date.now()) b.lease = null;
      }
    } else if (action === "cancel") {
      b.status = "cancelled";
      b.items = b.items.map((i) => (i.status === "queued" || i.status === "failed" ? { ...i, status: "cancelled", nextAttemptAt: undefined } : i));
      b.finishedAt = nowIso();
    } else if (action === "retry_failed") {
      let n = 0;
      b.items = b.items.map((i) => {
        if (i.status !== "failed" && i.status !== "cancelled") return i;
        n += 1;
        return { ...i, status: "queued", attempts: 0, nextAttemptAt: undefined, lastError: undefined };
      });
      if (!n) error = "No failed cities to retry.";
      else {
        b.status = "running";
        b.finishedAt = undefined;
      }
    }
    if (!error) b.log = [...b.log, stamp].slice(-40);
  });
  if (!updated) return { ok: false as const, error: "Batch not found." };
  if (error) return { ok: false as const, error };
  await updateIndex(projectId, (idx) => {
    idx.batches = idx.batches.map((b) => (b.id === batchId ? { ...b, status: updated.status } : b));
    if (action === "retry_failed" || action === "cancel") {
      for (const item of updated.items) {
        const p = idx.pages[item.slug];
        if (!p || p.batchId !== batchId) continue;
        if (item.status === "queued") p.status = "queued";
        if (item.status === "cancelled" && p.status !== "draft" && p.status !== "approved") p.status = "failed";
      }
    }
  });
  if (action === "resume" || action === "retry_failed") queueCityLaunchTick(projectId, batchId, hostOrigin);
  return { ok: true as const, batch: updated };
}

/* ------------------------------ production ------------------------------ */

/**
 * Record Tony's sign-off to put the approved city pages on the client's real domain.
 * This does NOT deploy anything: production stays the manual `production_deployment` step.
 */
export async function signOffCityProduction(projectId: string, approvedBy: string) {
  const who = approvedBy.trim();
  if (!who) return { ok: false as const, error: "approvedBy required (Tony's sign-off)." };
  const project = await findProjectById(projectId);
  if (!project) return { ok: false as const, error: "Client project not found." };
  if (!project.selectedDomain) return { ok: false as const, error: "Pick the client's domain first (DomainIQ section)." };
  const index = await readCityIndex(projectId);
  const approved = Object.values(index?.pages || {}).filter((p) => p.status === "approved" && p.gate?.status !== "block");
  if (!approved.length) return { ok: false as const, error: "No approved city pages to sign off." };
  const updated = await updateIndex(projectId, (idx) => {
    idx.production = {
      status: "signed_off",
      signedOffBy: who,
      signedOffAt: nowIso(),
      domain: project.selectedDomain,
      pageCount: approved.length,
      note: "Sign-off recorded. Production deploy to the client's domain is the manual production_deployment step - nothing was deployed.",
    };
  });
  return { ok: true as const, production: updated.production };
}

async function noteBatchOnWorkspace(projectId: string, batch: CityLaunchBatch) {
  const { readClientWorkspace, updateClientWorkspace } = await import("./client-workspace");
  if (!(await readClientWorkspace(projectId))) return;
  const c = countItems(batch.items);
  await updateClientWorkspace(projectId, (ws) => {
    const detail = `City Launch batch ${batch.id}: ${c.drafted}/${c.total} city drafts written (${batch.provider?.model || "llm"}), ${c.failed} failed. Review + approve on /app/clients/${projectId}; approved pages publish to the preview automatically; real-domain publish needs Tony's sign-off + manual production deploy.`;
    const gap = { id: "city-launch", area: "City Launch", owner: "operator" as const, status: "open" as const, detail };
    ws.visibleGaps = ws.visibleGaps.some((g) => g.id === "city-launch")
      ? ws.visibleGaps.map((g) => (g.id === "city-launch" ? gap : g))
      : [...ws.visibleGaps, gap];
    ws.stages = ws.stages.map((stage) =>
      stage.key === "content_drafting" && stage.status !== "approved" && stage.status !== "complete"
        ? { ...stage, status: "ready_for_review", notes: `${stage.notes ? `${stage.notes} ` : ""}City Launch: ${c.drafted} city drafts ready for review.`.slice(0, 600) }
        : stage
    );
    return ws;
  });
}

/* ------------------------------ summaries ------------------------------ */

export type CityLaunchSummary = {
  provider: ReturnType<typeof cityLaunchProviderStatus>;
  index: CityLaunchIndex | null;
  activeBatch: (Omit<CityLaunchBatch, "items"> & { counts: ReturnType<typeof countItems>; failedItems: BatchItem[] }) | null;
  counts: { total: number; queued: number; generating: number; failed: number; draft: number; approved: number; rejected: number; blocked: number; warned: number };
};

export function summarizeIndex(index: CityLaunchIndex | null) {
  const pages = Object.values(index?.pages || {});
  const by = (s: string) => pages.filter((p) => p.status === s).length;
  return {
    total: pages.length,
    queued: by("queued"),
    generating: by("generating"),
    failed: by("failed"),
    draft: by("draft"),
    approved: by("approved"),
    rejected: by("rejected"),
    blocked: pages.filter((p) => p.gate?.status === "block" && p.status !== "rejected").length,
    warned: pages.filter((p) => p.gate?.status === "warn" && p.status !== "rejected").length,
  };
}

export async function cityLaunchSummary(projectId: string, batchId?: string): Promise<CityLaunchSummary> {
  const index = await readCityIndex(projectId);
  const id = batchId || index?.batches[0]?.id;
  const batch = id ? await readCityBatch(projectId, id) : null;
  return {
    provider: cityLaunchProviderStatus(),
    index,
    activeBatch: batch
      ? (() => {
          const { items, ...rest } = batch;
          return { ...rest, counts: countItems(items), failedItems: items.filter((i) => i.status === "failed").slice(0, 50) };
        })()
      : null,
    counts: summarizeIndex(index),
  };
}

export type CityLaunchBaySummary = {
  provider: ReturnType<typeof cityLaunchProviderStatus>;
  dataset: { count: number; source: string; populationYear: number };
  totals: ReturnType<typeof summarizeIndex> & { runningBatches: number };
  rows: Array<{ id: string; name: string; city: string; counts: ReturnType<typeof summarizeIndex>; latestBatch?: { id: string; status: string; total: number } }>;
};

export async function summarizeCityLaunchBay(projects: ClientProject[]): Promise<CityLaunchBaySummary> {
  const { US_CITIES_META } = await import("@/lib/city-launch");
  const rows: CityLaunchBaySummary["rows"] = [];
  const totals = { ...summarizeIndex(null), runningBatches: 0 };
  for (const project of projects.slice(0, 25)) {
    let index: CityLaunchIndex | null = null;
    try {
      index = await readCityIndex(project.id);
    } catch {
      index = null;
    }
    const counts = summarizeIndex(index);
    for (const k of Object.keys(counts) as Array<keyof typeof counts>) totals[k] += counts[k];
    const latest = index?.batches[0];
    if (latest && (latest.status === "running" || latest.status === "queued")) totals.runningBatches += 1;
    rows.push({
      id: project.id,
      name: project.businessName || project.label,
      city: [project.city, project.state].filter(Boolean).join(", "),
      counts,
      latestBatch: latest ? { id: latest.id, status: latest.status, total: latest.total } : undefined,
    });
  }
  rows.sort((a, b) => b.counts.total - a.counts.total);
  return {
    provider: cityLaunchProviderStatus(),
    dataset: { count: US_CITIES_META.count, source: US_CITIES_META.source, populationYear: US_CITIES_META.populationYear },
    totals,
    rows: rows.slice(0, 12),
  };
}
