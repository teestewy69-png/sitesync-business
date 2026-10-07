/**
 * Client real-domain routing: pure, edge-safe host -> route mapping used by middleware.ts.
 *
 * A request whose Host is NOT one of Sitesinc's own hosts (sitesinc.co + subdomains such as test.sitesinc.co,
 * *.netlify.app / *.netlify.live deploy + preview hosts, localhost / IPs, and any host listed in SITESINC_HOSTS or the
 * deploy URL env vars) is treated as a client domain and rewritten to /client-domain/<host>/... . The Node pages behind
 * that prefix (app/client-domain/[host]/...) then look the host up: it is served only when it matches a ClientProject's
 * selectedDomain AND that project's City Launch production sign-off was recorded for the same domain. Everything else
 * 404s, so an unknown host never sees Sitesinc's own site or the operator app.
 *
 * No store access, no Node APIs: middleware runs on the edge.
 */

export const CLIENT_DOMAIN_PREFIX = "/client-domain";

/** Hosts that always belong to Sitesinc itself (exact or as a parent domain). */
export const SITESINC_HOST_SUFFIXES = ["sitesinc.co", "netlify.app", "netlify.live", "localhost"];

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type Env = Record<string, string | undefined>;

/** Lowercase, first value of a comma list, no port, no trailing dot. Returns "" for anything malformed. */
export function normalizeHost(raw: string | null | undefined): string {
  let host = String(raw || "").split(",")[0].trim().toLowerCase();
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(0, end + 1) : "";
  }
  host = host.replace(/:\d+$/, "").replace(/\.$/, "");
  if (host.length > 253) return "";
  return host;
}

/** "https://www.Example.com/path" -> "www.example.com"; "" when it is not a plausible public hostname. */
export function normalizeDomain(raw: string | null | undefined): string {
  let value = String(raw || "").trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0];
  const host = normalizeHost(value);
  if (!isPublicHostname(host)) return "";
  return host;
}

export function isPublicHostname(host: string): boolean {
  if (!host || !host.includes(".")) return false;
  if (isIpHost(host)) return false;
  const labels = host.split(".");
  if (!labels.every((l) => HOST_LABEL.test(l))) return false;
  return /^[a-z]{2,63}$|^xn--[a-z0-9-]+$/.test(labels[labels.length - 1]);
}

export function isIpHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":");
}

/** Local-only hosts used when developing with Host-header overrides (never production Sitesinc hosts). */
export function isLocalDevHost(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost);
  if (!host) return true;
  if (isIpHost(host)) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  return false;
}


/** example.com <-> www.example.com: the two hosts a client domain is served on. */
export function apexOf(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

export function domainHosts(domain: string): string[] {
  const d = normalizeDomain(domain);
  if (!d) return [];
  const apex = apexOf(d);
  return [apex, `www.${apex}`];
}

/** Same client domain, ignoring the www. prefix. */
export function sameClientDomain(a: string, b: string): boolean {
  const x = normalizeDomain(a);
  const y = normalizeDomain(b);
  return Boolean(x && y && apexOf(x) === apexOf(y));
}

function envHosts(env: Env): string[] {
  const out: string[] = [];
  for (const name of ["NEXT_PUBLIC_SITE_URL", "URL", "DEPLOY_PRIME_URL", "DEPLOY_URL", "SITE_URL"]) {
    const h = normalizeDomain(env[name]);
    if (h) out.push(h);
  }
  for (const part of String(env.SITESINC_HOSTS || "").split(/[\s,]+/)) {
    const h = normalizeHost(part.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split("/")[0]);
    if (h) out.push(h);
  }
  return out;
}

/** True for Sitesinc's own hosts (production, staging, Netlify deploy/preview hosts, local dev). */
export function isSitesincHost(rawHost: string | null | undefined, env: Env = {}): boolean {
  const host = normalizeHost(rawHost);
  if (!host) return true; // no Host header: never treat as a client domain
  if (isIpHost(host)) return true;
  if (!host.includes(".")) return true; // bare names (localhost, docker service names)
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  for (const suffix of SITESINC_HOST_SUFFIXES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return true;
  }
  return envHosts(env).some((h) => host === h || apexOf(host) === apexOf(h));
}

export type ClientRoute =
  | { kind: "pass" } // Next.js build assets
  | { kind: "rewrite"; pathname: string }
  | { kind: "not_found" };

/**
 * Map a client-domain request path to the internal route. Only the public client routes exist on a client domain:
 *   /                       -> home
 *   /locations              -> service-area index
 *   /locations/<citySlug>   -> City Launch page
 *   /sitemap.xml, /robots.txt
 *   /<slug>                 -> an approved client page (contact, services...)
 * Trailing slashes are accepted. /app, /api, /demo and every Sitesinc marketing route are not_found.
 */
export function clientDomainRoute(rawHost: string, pathname: string): ClientRoute {
  const host = normalizeHost(rawHost);
  if (!isPublicHostname(host)) return { kind: "not_found" };
  if (pathname.startsWith("/_next/")) return { kind: "pass" };
  let p = pathname || "/";
  try {
    p = decodeURIComponent(p);
  } catch {
    return { kind: "not_found" };
  }
  if (p.length > 1) p = p.replace(/\/+$/, "");
  const base = `${CLIENT_DOMAIN_PREFIX}/${host}`;
  if (p === "/" || p === "") return { kind: "rewrite", pathname: base };
  if (p === "/sitemap.xml") return { kind: "rewrite", pathname: `${base}/sitemap.xml` };
  if (p === "/robots.txt") return { kind: "rewrite", pathname: `${base}/robots.txt` };
  if (p === "/locations") return { kind: "rewrite", pathname: `${base}/locations` };
  const city = /^\/locations\/([^/]+)$/.exec(p);
  if (city) return SLUG.test(city[1]) ? { kind: "rewrite", pathname: `${base}/locations/${city[1]}` } : { kind: "not_found" };
  const page = /^\/([^/]+)$/.exec(p);
  if (page && SLUG.test(page[1]) && !RESERVED_TOP_LEVEL.has(page[1])) return { kind: "rewrite", pathname: `${base}/${page[1]}` };
  return { kind: "not_found" };
}

/** Top-level names that are never client pages on a client domain (Sitesinc app/API/internal routes). */
export const RESERVED_TOP_LEVEL = new Set(["app", "api", "demo", "client-domain", "home", "locations", "favicon.ico"]);
