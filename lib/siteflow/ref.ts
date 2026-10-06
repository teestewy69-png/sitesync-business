/**
 * In-house referral attribution helpers (pure; no store access, safe for middleware and tests).
 *
 * Flow: a visitor lands on any page with `?ref=<code>`. Middleware sends them through
 * /api/siteflow/ref, which validates the code against the partners collection in Blobs, sets the
 * HttpOnly `sf_ref` cookie for the configured window and redirects back to the clean URL.
 * Checkout re-validates the cookie, saves the code on the order and in Stripe metadata.
 */

export const REF_COOKIE = "sf_ref";
export const REF_PARAM = "ref";
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;
const DEFAULT_REF_WINDOW_DAYS = 30;

/** Lowercased partner code, or "" when the value can never be a valid code. */
export function normalizeRefCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const code = raw.trim().toLowerCase();
  return CODE_PATTERN.test(code) ? code : "";
}

/** Attribution window (days) for the ref cookie. SITEFLOW_REF_WINDOW_DAYS, 1..365. */
export function refWindowDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.SITEFLOW_REF_WINDOW_DAYS);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.floor(n) : DEFAULT_REF_WINDOW_DAYS;
}

/**
 * Comparable mailbox identity for the self-referral check: lowercase, strip "+tag",
 * and ignore dots for Gmail (which delivers a.b@gmail.com and ab@gmail.com to the same inbox).
 */
export function mailboxIdentity(email: string): string {
  const value = (email || "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0) return value;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** A partner cannot earn commission on their own purchase. */
export function isSelfReferral(partnerEmail: string | undefined, buyerEmails: Array<string | undefined | null>): boolean {
  if (!partnerEmail) return false;
  const partner = mailboxIdentity(partnerEmail);
  return buyerEmails.some((email) => Boolean(email) && mailboxIdentity(String(email)) === partner);
}

/** Only same-site relative paths are allowed as redirect targets (blocks open redirects). */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (/[\r\n]/.test(raw)) return "/";
  return raw.slice(0, 1000);
}

/** Path + query without the ref param (what the visitor is redirected back to). */
export function stripRefParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(REF_PARAM);
  const rest = params.toString();
  return `${pathname}${rest ? `?${rest}` : ""}`;
}

/**
 * Should middleware hand this request to the ref endpoint? Page navigations only: never API, factory,
 * downloads, the redirect endpoints themselves, or static files.
 */
export function shouldCaptureRef(method: string, pathname: string, search: string): string {
  if (method !== "GET") return "";
  if (
    pathname.startsWith("/api/") ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/go/") ||
    pathname.startsWith("/_next/") ||
    /\.[a-z0-9]{2,5}$/i.test(pathname)
  ) {
    return "";
  }
  const raw = new URLSearchParams(search).get(REF_PARAM);
  return raw === null ? "" : normalizeRefCode(raw) || "invalid";
}

/** The shareable link for a partner. */
export function partnerLink(origin: string, code: string, path = "/"): string {
  const url = new URL(path, origin);
  url.searchParams.set(REF_PARAM, code);
  return url.toString();
}
