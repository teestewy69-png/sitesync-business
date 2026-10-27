import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/**
 * Google service-account auth for the factory (server-side only).
 *
 * GOOGLE_SERVICE_ACCOUNT_KEY_FILE points at the downloaded service-account JSON key on this machine.
 * We sign a short-lived JWT with Node's crypto (no extra packages), exchange it for an OAuth access
 * token, and cache that token until shortly before it expires (Google issues ~1 hour tokens).
 * The key contents and tokens are never logged or put in error messages.
 */

export const GOOGLE_KEY_FILE_ENV = "GOOGLE_SERVICE_ACCOUNT_KEY_FILE";
export const SCOPE_SEARCH_CONSOLE = "https://www.googleapis.com/auth/webmasters.readonly";
export const SCOPE_ANALYTICS = "https://www.googleapis.com/auth/analytics.readonly";

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
/** Refresh this long before the token really expires. */
const EXPIRY_SKEW_MS = 60_000;

export type ServiceAccountKey = { client_email: string; private_key: string; token_uri?: string };

export type TokenProviderDeps = {
  /** Path to the key file; defaults to process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE. */
  keyFile?: () => string;
  readFile?: (path: string) => string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type CachedToken = { token: string; expiresAt: number };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Service account key file is not valid JSON.");
  }
  const key = parsed as Partial<ServiceAccountKey>;
  if (!key || typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    throw new Error("Service account key file is missing client_email or private_key.");
  }
  return { client_email: key.client_email, private_key: key.private_key, token_uri: key.token_uri };
}

/** Build the signed JWT assertion for the OAuth2 jwt-bearer grant. */
export function signAssertion(key: ServiceAccountKey, scope: string, nowMs: number): string {
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: key.token_uri || DEFAULT_TOKEN_URI,
      iat,
      exp: iat + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

export function createTokenProvider(deps: TokenProviderDeps = {}) {
  const keyFile = deps.keyFile ?? (() => (process.env[GOOGLE_KEY_FILE_ENV] || "").trim());
  const readFile = deps.readFile ?? ((p: string) => readFileSync(p, "utf8"));
  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = deps.now ?? (() => Date.now());
  const cache = new Map<string, CachedToken>();
  const inflight = new Map<string, Promise<string>>();

  async function mint(scope: string): Promise<string> {
    const file = keyFile();
    if (!file) throw new Error(`${GOOGLE_KEY_FILE_ENV} is not set.`);
    let raw: string;
    try {
      raw = readFile(file);
    } catch {
      throw new Error(`Cannot read the service account key file at ${GOOGLE_KEY_FILE_ENV}.`);
    }
    const key = parseServiceAccountKey(raw);
    const assertion = signAssertion(key, scope, now());
    const res = await doFetch(key.token_uri || DEFAULT_TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    if (!res.ok) {
      // Google's error body names the problem (e.g. invalid_grant) but never echoes our assertion.
      const body = (await res.text()).slice(0, 160);
      throw new Error(`Google token request failed (${res.status}). ${body}`);
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error("Google token response had no access_token.");
    const ttlMs = Math.max(0, Number(data.expires_in) || 3600) * 1000;
    cache.set(scope, { token: data.access_token, expiresAt: now() + ttlMs - EXPIRY_SKEW_MS });
    return data.access_token;
  }

  /** Access token for one scope, minted on demand and cached until ~1 minute before expiry. */
  async function getToken(scope: string): Promise<string> {
    const hit = cache.get(scope);
    if (hit && hit.expiresAt > now()) return hit.token;
    const pending = inflight.get(scope);
    if (pending) return pending;
    const run = mint(scope).finally(() => inflight.delete(scope));
    inflight.set(scope, run);
    return run;
  }

  return { getToken, clear: () => cache.clear() };
}

const shared = createTokenProvider();

export function getServiceAccountToken(scope: string): Promise<string> {
  return shared.getToken(scope);
}

/** True when a key file path is set and the file exists. Does not read or validate its contents. */
export function serviceAccountConfigured(): boolean {
  const file = (process.env[GOOGLE_KEY_FILE_ENV] || "").trim();
  return Boolean(file) && existsSync(file);
}
