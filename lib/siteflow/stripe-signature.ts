/**
 * Stripe webhook signature verification (no SDK). Same scheme as stripe-node's
 * `webhooks.constructEvent`: header `Stripe-Signature: t=<unix>,v1=<hex hmac>[,v1=...]`, where
 * v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). Must run on the RAW request body, never re-serialized JSON.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_TOLERANCE_SEC = 300;

export type SignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing_header" | "malformed_header" | "no_secret" | "timestamp_out_of_tolerance" | "signature_mismatch" };

export function parseSignatureHeader(header: string): { timestamp: number; v1: string[] } | null {
  let timestamp = Number.NaN;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]+$/i.test(value)) v1.push(value.toLowerCase());
  }
  if (!Number.isInteger(timestamp) || timestamp <= 0 || v1.length === 0) return null;
  return { timestamp, v1 };
}

export function computeSignature(rawBody: string, secret: string, timestamp: number): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/**
 * Verify a Stripe-Signature header against one or more endpoint secrets (several during a secret roll).
 * `nowSec` is injectable for tests.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secrets: string[],
  opts: { toleranceSec?: number; nowSec?: number } = {}
): SignatureCheck {
  const usable = secrets.map((s) => s.trim()).filter(Boolean);
  if (!usable.length) return { ok: false, reason: "no_secret" };
  if (!header) return { ok: false, reason: "missing_header" };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: "malformed_header" };
  const tolerance = opts.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (tolerance > 0 && Math.abs(now - parsed.timestamp) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }
  for (const secret of usable) {
    const expected = computeSignature(rawBody, secret, parsed.timestamp);
    if (parsed.v1.some((candidate) => safeEqualHex(candidate, expected))) {
      return { ok: true, timestamp: parsed.timestamp };
    }
  }
  return { ok: false, reason: "signature_mismatch" };
}

/** Build a valid header for a payload (tests and the local end-to-end script; mirrors Stripe's test helper). */
export function signStripePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${computeSignature(rawBody, secret, timestamp)}`;
}

/** STRIPE_WEBHOOK_SECRET, optionally comma-separated while rolling secrets. Never logged. */
export function webhookSecrets(env: Record<string, string | undefined> = process.env): string[] {
  return (env.STRIPE_WEBHOOK_SECRET || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
