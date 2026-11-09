/**
 * Exit-intent email capture: pure decision logic for components/ExitIntentCapture.tsx.
 *
 * No DOM access in this module — every input arrives as an argument so the
 * rules are unit-testable (scripts/exit-intent.test.mjs). The offer behind the
 * popup is the free website audit; submissions post to /api/subscribe with the
 * same contract as components/EmailCapture.tsx.
 */

/** How long a visitor must be on the page before exit triggers may arm. */
export const DWELL_THRESHOLD_MS = 8_000;

/** After the popup is shown once, suppress it for this long (30 days). */
export const SUPPRESSION_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

/** localStorage key holding the ISO timestamp of the last popup showing. */
export const SEEN_STORAGE_KEY = "sitesinc-exit-capture-seen";

/** Desktop trigger: the pointer leaves the viewport within this many px of the top edge. */
export const DESKTOP_EXIT_TOP_PX = 8;

/** Mobile trigger: the visitor must first have scrolled down at least this far. */
export const MOBILE_MIN_SCROLL_PX = 600;

/** Mobile trigger: an upward burst of at least this many px... */
export const MOBILE_BURST_UP_PX = 350;

/** ...completed within this many ms counts as leaving intent. */
export const MOBILE_BURST_WINDOW_MS = 300;

/** Paths where the popup must never appear (exact match or any subpath). */
const EXCLUDED_PATHS = [
  "/store",
  "/cart",
  "/checkout",
  "/app",
  "/free-website-audit",
  "/api",
] as const;

function normalizePathname(pathname: string): string {
  const path = (pathname || "/").split(/[?#]/)[0];
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** True for commerce, factory, API, and the audit page itself — never interrupt those. */
export function isExcludedPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return EXCLUDED_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Whether exit triggers may be attached for this page view at all. */
export function shouldArm(input: {
  pathname: string;
  dwellMs: number;
  alreadySeen: boolean;
}): boolean {
  if (input.alreadySeen) return false;
  if (input.dwellMs < DWELL_THRESHOLD_MS) return false;
  return !isExcludedPath(input.pathname);
}

/** True when the popup was shown less than SUPPRESSION_WINDOW_MS ago. Bad or missing timestamps never suppress. */
export function hasSeenRecently(
  seenAtIso: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!seenAtIso) return false;
  const seen = Date.parse(seenAtIso);
  if (Number.isNaN(seen)) return false;
  const age = now.getTime() - seen;
  return age >= 0 && age < SUPPRESSION_WINDOW_MS;
}

/**
 * Mobile leaving-intent math: the visitor had scrolled down at least
 * MOBILE_MIN_SCROLL_PX at some point, and the current upward movement covers
 * at least MOBILE_BURST_UP_PX within MOBILE_BURST_WINDOW_MS.
 */
export function isExitScrollBurst(input: {
  maxScrollY: number;
  fromY: number;
  toY: number;
  elapsedMs: number;
}): boolean {
  if (input.maxScrollY < MOBILE_MIN_SCROLL_PX) return false;
  if (input.toY >= input.fromY) return false;
  return (
    input.fromY - input.toY >= MOBILE_BURST_UP_PX &&
    input.elapsedMs <= MOBILE_BURST_WINDOW_MS
  );
}
