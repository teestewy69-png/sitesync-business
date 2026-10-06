/**
 * Minimal Stripe REST client (fetch + form encoding, no SDK dependency). Server-only.
 * The secret key is read from STRIPE_SECRET_KEY and never logged or returned.
 */
import { redactSecrets } from "./sanitize";

export type StripeKeyMode = "test" | "live" | "unset" | "invalid";

export function stripeSecretKey(env: Record<string, string | undefined> = process.env): string {
  return (env.STRIPE_SECRET_KEY || "").trim();
}

export function stripeKeyMode(key: string): StripeKeyMode {
  if (!key) return "unset";
  if (/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key)) return "test";
  if (/^(sk|rk)_live_[A-Za-z0-9]+$/.test(key)) return "live";
  return "invalid";
}

export type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/** Stripe's bracket notation: {a:{b:1}, c:[x,y]} → a[b]=1&c[0]=x&c[1]=y. Undefined/null are skipped. */
export function encodeForm(params: Record<string, FormValue>): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (prefix: string, value: FormValue) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(`${prefix}[${i}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(prefix ? `${prefix}[${k}]` : k, v);
      return;
    }
    out.append(prefix, String(value));
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out;
}

export class StripeApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
    this.code = code;
  }
}

export async function stripeApi<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, FormValue> = {},
  opts: { idempotencyKey?: string; key?: string; timeoutMs?: number } = {}
): Promise<T> {
  const key = opts.key ?? stripeSecretKey();
  if (!key) throw new StripeApiError(0, "Stripe is not configured.");
  const body = encodeForm(params);
  const url = new URL(`https://api.stripe.com${path}`);
  if (method === "GET") body.forEach((v, k) => url.searchParams.append(k, v));
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (method !== "GET") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : body,
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
    if (!res.ok) {
      throw new StripeApiError(
        res.status,
        redactSecrets(data?.error?.message || `Stripe request failed (HTTP ${res.status}).`),
        data?.error?.code
      );
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export type StripePrice = {
  id: string;
  lookup_key: string | null;
  unit_amount: number | null;
  currency: string;
  active: boolean;
  product: string;
  recurring: { interval: string } | null;
};

let priceCache: { at: number; byKey: Map<string, StripePrice> } | null = null;
const PRICE_CACHE_MS = 5 * 60_000;

/** Active Stripe prices for these lookup keys (read-only). Cached for 5 minutes per instance. */
export async function pricesByLookupKey(keys: string[], opts: { fresh?: boolean } = {}): Promise<Map<string, StripePrice>> {
  const wanted = [...new Set(keys.filter(Boolean))];
  const result = new Map<string, StripePrice>();
  if (!wanted.length) return result;
  const now = Date.now();
  if (!opts.fresh && priceCache && now - priceCache.at < PRICE_CACHE_MS && wanted.every((k) => priceCache!.byKey.has(k))) {
    for (const k of wanted) result.set(k, priceCache.byKey.get(k)!);
    return result;
  }
  const list = await stripeApi<{ data: StripePrice[] }>("GET", "/v1/prices", {
    lookup_keys: wanted,
    active: "true",
    limit: 100,
  });
  for (const price of list.data || []) if (price.lookup_key) result.set(price.lookup_key, price);
  const byKey = new Map(priceCache && now - priceCache.at < PRICE_CACHE_MS ? priceCache.byKey : []);
  for (const [k, v] of result) byKey.set(k, v);
  priceCache = { at: now, byKey };
  return result;
}
