/**
 * City Launch writing loop as a Netlify Background Function (netlify/functions/city-launch-background.mts).
 *
 * Why: a synchronous Netlify function stops at ~26 s, so the Next route can only write for ~18 s per tick and then
 * chains a new HTTP tick. A background function runs up to 15 minutes per invocation, so a batch of hundreds of
 * cities needs a handful of invocations instead of hundreds of chained ticks.
 *
 * Flow: queueCityLaunchTick / continueTick POST here (202 = accepted). The handler runs runCityLaunchTick with a
 * ~13 minute budget under the same lease, so a concurrent chained tick or a second invocation exits immediately.
 * If work remains it re-triggers itself; if the function is missing or refuses (not deployed, local dev,
 * CITY_LAUNCH_BACKGROUND=off) the caller falls back to the existing chained /api/factory/city-launch/tick path.
 *
 * Auth: the factory session cookie value (sha256 of FACTORY_ACCESS_TOKEN), same as every /api/factory route.
 */
import { FACTORY_COOKIE, isValidSession } from "./auth";

export const BACKGROUND_FUNCTION_PATH = "/.netlify/functions/city-launch-background";
/** Netlify background functions stop at 15 minutes; leave room for the gate run and the final writes. */
export const BACKGROUND_BUDGET_MS = 13 * 60_000;

const SAFE_ID = /^[a-z0-9_-]{1,80}$/i;

/** A hand-off the function never picked up within this window means it is not working: use chained ticks. */
export const BACKGROUND_START_GRACE_MS = 90_000;

/** True when the last hand-off was not picked up in time (function missing, crashing, or misconfigured). */
export function backgroundLooksStuck(bgState: { requestedAt?: string; startedAt?: string } | undefined, now = Date.now()): boolean {
  if (!bgState?.requestedAt) return false;
  const requested = Date.parse(bgState.requestedAt);
  if (!Number.isFinite(requested) || now - requested < BACKGROUND_START_GRACE_MS) return false;
  const started = bgState.startedAt ? Date.parse(bgState.startedAt) : NaN;
  return !(Number.isFinite(started) && started >= requested);
}

/**
 * A hand-off was requested less than BACKGROUND_START_GRACE_MS ago and the function has not reported in yet.
 * Callers must not re-trigger then (that would keep pushing requestedAt forward and hide a function that never
 * starts); they wait, and after the grace period backgroundLooksStuck() switches the batch to chained ticks.
 */
export function backgroundPending(bgState: { requestedAt?: string; startedAt?: string } | undefined, now = Date.now()): boolean {
  if (!bgState?.requestedAt) return false;
  const requested = Date.parse(bgState.requestedAt);
  if (!Number.isFinite(requested) || now - requested >= BACKGROUND_START_GRACE_MS) return false;
  const started = bgState.startedAt ? Date.parse(bgState.startedAt) : NaN;
  return !(Number.isFinite(started) && started >= requested);
}

export type BackgroundDeps = {
  runTick: (projectId: string, batchId: string, opts: { budgetMs: number; hostOrigin?: string | null }) => Promise<{ ok: boolean; status: string; drafted: number; failed: number; remaining: number; continued: string; detail?: string }>;
  isValidSession: (cookie: string | undefined) => Promise<boolean>;
  markStarted: (projectId: string, batchId: string) => Promise<void>;
  budgetMs?: number;
};

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** The function body (Netlify has already answered 202 to the caller; this return value is only logged). */
export async function handleCityLaunchBackground(req: Request, deps?: Partial<BackgroundDeps>): Promise<Response> {
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only." });
  const check = deps?.isValidSession || isValidSession;
  if (!(await check(cookieValue(req.headers.get("cookie"), FACTORY_COOKIE)))) {
    return json(401, { ok: false, error: "Factory authentication required." });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = String(body.projectId || "");
  const batchId = String(body.batchId || "");
  if (!SAFE_ID.test(projectId) || !SAFE_ID.test(batchId)) return json(400, { ok: false, error: "projectId and batchId required." });
  let origin: string | null = null;
  try {
    origin = new URL(req.url).origin;
  } catch {
    origin = null;
  }
  const cl = deps?.runTick && deps?.markStarted ? null : await import("./city-launch");
  const runTick = deps?.runTick || cl!.runCityLaunchTick;
  const markStarted = deps?.markStarted || cl!.markCityBackgroundStarted;
  // Proof of life for the caller's stuck-detection (backgroundLooksStuck).
  await markStarted(projectId, batchId).catch(() => undefined);
  const started = Date.now();
  const result = await runTick(projectId, batchId, { budgetMs: deps?.budgetMs ?? BACKGROUND_BUDGET_MS, hostOrigin: origin });
  console.log(
    `[city-launch-background] ${projectId}/${batchId}: ${result.status} drafted ${result.drafted} failed ${result.failed} remaining ${result.remaining} in ${Math.round((Date.now() - started) / 1000)}s, continued=${result.continued}${result.detail ? ` (${result.detail})` : ""}`
  );
  return json(200, result);
}

/** Whether to hand the writing loop to the background function (Netlify only; CITY_LAUNCH_BACKGROUND=off disables). */
export function backgroundEnabled(env: Record<string, string | undefined>, onNetlify: boolean): boolean {
  const flag = (env.CITY_LAUNCH_BACKGROUND || "").trim().toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return false;
  if (flag === "on" || flag === "1" || flag === "true") return true;
  return onNetlify;
}

/**
 * POST the batch to the background function. true only on 202 (Netlify accepted it); anything else (404 when the
 * function is not deployed, 401, network error, timeout) returns false so the caller uses the chained tick instead.
 */
export async function triggerBackground(
  origin: string,
  cookie: string,
  payload: { projectId: string; batchId: string },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${origin}${BACKGROUND_FUNCTION_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return res.status === 202;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
