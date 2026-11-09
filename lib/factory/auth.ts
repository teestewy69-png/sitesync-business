export const FACTORY_COOKIE = "factory_session";

/** Exact loopback names Tony uses with `next dev -H 127.0.0.1`. Not the rest of 127.0.0.0/8, not *.localhost. */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isHostedRuntime(): boolean {
  return Boolean(process.env.NETLIFY || process.env.CONTEXT || process.env.NODE_ENV === "production");
}

export function factoryToken(): string {
  const env = process.env.FACTORY_ACCESS_TOKEN?.trim();
  if (env) return env;
  if (!isHostedRuntime() && process.env.NODE_ENV !== "production") {
    return "local-dev-only";
  }
  return "";
}

export async function sessionValue(token = factoryToken()): Promise<string> {
  const data = new TextEncoder().encode(`sitesinc-factory:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  const token = factoryToken();
  if (!token || !cookie) return false;
  const expected = await sessionValue(token);
  return cookie === expected;
}

/**
 * Lowercase host without port. IPv6 Host headers are `[::1]:3000` → `[::1]`.
 * Empty / malformed values become "" (fail closed for the bypass).
 */
export function factoryAuthHost(raw: string | null | undefined): string {
  let host = String(raw || "").trim().toLowerCase();
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(0, end + 1) : "";
  }
  // Unbracketed IPv6 (`::1`) must not be treated as `host:port` (`:1` is not a TCP port).
  if (host.includes("::")) return host;
  return host.replace(/:\d+$/, "");
}

export function isLoopbackHost(rawHost: string | null | undefined): boolean {
  return LOOPBACK_HOSTS.has(factoryAuthHost(rawHost));
}

/**
 * Open /app and Factory APIs with no token on Tony's PC only:
 *   NODE_ENV !== "production" AND not Netlify (NETLIFY / CONTEXT) AND Host is loopback.
 *
 * Loopback detection uses the `Host` header (what `next dev` sees from the browser), then
 * `nextUrl.hostname` if Host is missing. It does **not** use `x-forwarded-host`,
 * `x-forwarded-for`, or `x-real-ip` — those are client-controlled even on a local server.
 *
 * Binding `next dev` to 127.0.0.1 (the Windows launcher does) is the real network gate:
 * a process listening on 0.0.0.0 in development would accept a spoofed `Host: 127.0.0.1`
 * from the LAN. Production / Netlify / any non-loopback Host keep the token gate (fail closed).
 *
 * Why the `local-dev-only` fallback was a "wrong key": `factoryToken()` returns
 * `FACTORY_ACCESS_TOKEN` from the environment *before* that fallback. `next dev` loads
 * `.env.local` automatically, and `.env.local.example` ships a placeholder token, so typing
 * `local-dev-only` is compared against the env value and rejected ("That access token is not valid").
 * Secure cookies are not the cause (`secure` is only set when NODE_ENV is production). Session
 * signing is SHA-256 of `sitesinc-factory:${token}` in both the login route and middleware;
 * they only disagree if they see different tokens (env vs fallback).
 */
export function allowLocalDevFactoryBypass(headers: Headers, urlHostname?: string | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NETLIFY || process.env.CONTEXT) return false;
  const headerHost = headers.get("host");
  if (headerHost) return isLoopbackHost(headerHost);
  return isLoopbackHost(urlHostname || "");
}

export async function isAuthorizedFactoryRequest(req: {
  cookies: { get: (name: string) => { value: string } | undefined };
  headers: Headers;
  nextUrl?: { hostname?: string };
}): Promise<boolean> {
  if (allowLocalDevFactoryBypass(req.headers, req.nextUrl?.hostname)) return true;
  return isValidSession(req.cookies.get(FACTORY_COOKIE)?.value);
}

export function isPublicFactoryPath(pathname: string): boolean {
  return pathname === "/app/login" || pathname === "/api/factory/login";
}
