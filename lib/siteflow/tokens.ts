/**
 * HMAC-signed, expiring download tokens for /api/download/[token].
 * token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payloadPart))
 * The payload names an order and a private file key; the route re-checks the order is still paid.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type DownloadPayload = {
  /** order id */
  o: string;
  /** private deliverables-store key */
  k: string;
  /** download filename */
  f: string;
  /** expiry, unix seconds */
  exp: number;
};

export type TokenCheck =
  | { ok: true; payload: DownloadPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "no_secret" };

const DEFAULT_TTL_HOURS = 72;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(part: string, secret: string): string {
  return createHmac("sha256", secret).update(part, "utf8").digest("base64url");
}

export function signDownloadToken(payload: DownloadPayload, secret: string): string {
  if (!secret) throw new Error("Download signing secret is not configured.");
  const part = b64url(JSON.stringify(payload));
  return `${part}.${sign(part, secret)}`;
}

export function verifyDownloadToken(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): TokenCheck {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (typeof token !== "string" || token.length > 2000) return { ok: false, reason: "malformed" };
  const [part, sig, extra] = token.split(".");
  if (!part || !sig || extra !== undefined) return { ok: false, reason: "malformed" };
  const expected = sign(part, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  let payload: DownloadPayload;
  try {
    payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as DownloadPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    !payload ||
    typeof payload.o !== "string" ||
    typeof payload.k !== "string" ||
    typeof payload.f !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (payload.exp <= nowSec) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

export function downloadTtlHours(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.DOWNLOAD_LINK_TTL_HOURS);
  return Number.isFinite(n) && n >= 1 && n <= 24 * 30 ? Math.floor(n) : DEFAULT_TTL_HOURS;
}

function isHosted(env: Record<string, string | undefined>): boolean {
  return Boolean(env.NETLIFY || env.CONTEXT || env.NODE_ENV === "production");
}

/**
 * DOWNLOAD_SIGNING_SECRET. Local `next dev` (not hosted, not production) gets a fixed dev-only secret so
 * the flow can be tested end to end; hosted runtimes without the env var fail closed (no links issued).
 */
export function downloadSigningSecret(env: Record<string, string | undefined> = process.env): string {
  const value = (env.DOWNLOAD_SIGNING_SECRET || "").trim();
  if (value) return value;
  return isHosted(env) ? "" : "local-dev-only-download-secret";
}

export function downloadSigningConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean((env.DOWNLOAD_SIGNING_SECRET || "").trim());
}
