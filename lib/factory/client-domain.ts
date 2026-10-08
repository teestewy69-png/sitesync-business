/**
 * Client real-domain resolution (Node side of lib/client-domain/host.ts).
 *
 * A host is served as a client site only when ALL of these hold:
 *   1. a ClientProject's selectedDomain is that host (apex or www),
 *   2. the project's City Launch production sign-off is recorded (index.production.status === "signed_off"),
 *   3. the signed-off domain is the same domain as the current selectedDomain (changing the domain needs a new sign-off).
 * Lookup: the host index written at sign-off (factory/client-domains/<host>), then a cached scan of projects as a
 * fallback (covers sign-offs recorded before the index existed). Results are re-verified on every request.
 */
import { domainHosts, isLocalDevHost, isPublicHostname, isSitesincHost, normalizeDomain, normalizeHost, sameClientDomain } from "@/lib/client-domain/host";
import type { CityLaunchIndex } from "@/lib/city-launch/job";
import { readDoc, writeDoc } from "@/lib/persistence";
import { findProjectById, listProjects, type ClientProject } from "@/lib/store";
import { readCityIndex } from "./city-launch";

type DomainDoc = { projectId: string; domain: string; recordedAt: string };

const domainKey = (host: string) => `factory/client-domains/${host}`;

/**
 * Public Host the client-domain pages should treat as the client domain.
 * Prefer the middleware-stamped Host (survives local rewrites where nextUrl.host becomes localhost).
 * Returns "" when only a local/Sitesinc Host is present — callers then trust the routed [host] param
 * (middleware already 404s direct /client-domain/* on Sitesinc hosts).
 */
function requestClientHost(headerHost: string | null | undefined, stampedHost?: string | null): string {
  const stamped = normalizeHost(stampedHost);
  if (stamped && isPublicHostname(stamped) && !isSitesincHost(stamped, process.env)) return stamped;
  const actual = normalizeHost(headerHost);
  if (actual && isPublicHostname(actual) && !isSitesincHost(actual, process.env)) return actual;
  return "";
}



export type ResolvedClientDomain = {
  project: ClientProject;
  index: CityLaunchIndex;
  /** Canonical host: the selectedDomain exactly as chosen (apex or www). */
  domain: string;
};

/** Pure verification (exported for tests): project + index qualify for this host. */
export function qualifiesForHost(host: string, project: Pick<ClientProject, "selectedDomain"> | null, index: Pick<CityLaunchIndex, "production"> | null): boolean {
  if (!project?.selectedDomain || !index?.production) return false;
  if (index.production.status !== "signed_off" || !index.production.domain) return false;
  return sameClientDomain(project.selectedDomain, host) && sameClientDomain(index.production.domain, project.selectedDomain);
}

/** Written at City Launch production sign-off so the host -> project lookup is one read. */
export async function recordClientDomain(projectId: string, domain: string): Promise<void> {
  const recordedAt = new Date().toISOString();
  for (const host of domainHosts(domain)) {
    await writeDoc<DomainDoc>(domainKey(host), { projectId, domain: normalizeDomain(domain), recordedAt });
  }
}

let scanCache: { at: number; map: Map<string, string> } | null = null;
const SCAN_TTL_MS = 60_000;

async function scanForHost(host: string): Promise<string | null> {
  if (!scanCache || Date.now() - scanCache.at > SCAN_TTL_MS) {
    const map = new Map<string, string>();
    for (const p of await listProjects()) {
      for (const h of domainHosts(p.selectedDomain || "")) if (!map.has(h)) map.set(h, p.id);
    }
    scanCache = { at: Date.now(), map };
  }
  return scanCache.map.get(host) || null;
}

export async function resolveClientDomain(rawHost: string): Promise<ResolvedClientDomain | null> {
  const host = normalizeDomain(rawHost);
  if (!host) return null;
  const candidates: string[] = [];
  const doc = await readDoc<DomainDoc>(domainKey(host)).catch(() => null);
  if (doc?.value?.projectId) candidates.push(doc.value.projectId);
  const scanned = await scanForHost(host).catch(() => null);
  if (scanned && !candidates.includes(scanned)) candidates.push(scanned);
  for (const id of candidates) {
    const project = await findProjectById(id);
    if (!project) continue;
    const index = await readCityIndex(id).catch(() => null);
    if (index && qualifiesForHost(host, project, index)) {
      return { project, index, domain: normalizeDomain(project.selectedDomain) };
    }
  }
  return null;
}

export type ClientSite = ResolvedClientDomain & { origin: string };

/**
 * For app/client-domain/[host]/... pages: the Host header must be the routed host (no direct /client-domain/ access),
 * the host must resolve, and www <-> apex requests are 308-redirected to the canonical domain.
 */
export async function requireClientSite(hostParam: string, path: string): Promise<ClientSite> {
  // Lazy next/* imports: city-launch (shared with the background function) imports this module.
  const [{ headers }, { notFound, permanentRedirect }] = await Promise.all([import("next/headers"), import("next/navigation")]);
  const h = await headers();
  const hHost = h.get("host") || h.get("x-forwarded-host");
  const actual = requestClientHost(hHost, h.get("x-sitesinc-client-host"));
  const routed = normalizeHost(decodeURIComponent(hostParam));
  // Production: public Host must be this client domain (apex/www). Local Host-header tests: after a
  // cross-host rewrite follow-up, Host is localhost — trust the routed param only on local-dev hosts.
  if (!routed) return notFound();
  if (actual && !sameClientDomain(actual, routed)) return notFound();
  if (!actual && !isLocalDevHost(hHost)) return notFound();
  const site = await resolveClientDomain(routed);
  if (!site) return notFound();
  if (routed !== site.domain) return permanentRedirect(`https://${site.domain}${path}`);
  return { ...site, origin: `https://${site.domain}` };
}

/* ------------------------------ site content ------------------------------ */

export type PublishedClientPage = { slug: string; path: string; title: string; metaDescription: string; body: string; headings: string[] };

const PUBLISHED_STATUSES = new Set(["approved", "staged", "published"]);
const DRAFT_MARKER = /\[FACTORY DRAFT/i;

/** Workspace pages that may appear on the client's real domain: approved (or later) with a real, non-seed body. */
export function publishedClientPages(pages: Array<{ slug: string; title: string; metaDescription?: string; body?: string; headings?: string[]; status: string }>): PublishedClientPage[] {
  return pages
    .filter((p) => PUBLISHED_STATUSES.has(p.status) && (p.body || "").trim().length > 0 && !DRAFT_MARKER.test(p.body || ""))
    .map((p) => ({
      slug: p.slug,
      path: p.slug === "home" ? "/" : `/${p.slug}`,
      title: p.title,
      metaDescription: p.metaDescription || "",
      body: p.body || "",
      headings: p.headings || [],
    }));
}

export async function loadPublishedPages(projectId: string): Promise<PublishedClientPage[]> {
  const { readClientWorkspace } = await import("./client-workspace");
  const ws = await readClientWorkspace(projectId).catch(() => null);
  return publishedClientPages(ws?.pages || []);
}

/** Absolute URLs for the client-domain sitemap: only what the domain actually serves. */
export function clientSitemapUrls(
  root: string,
  pages: PublishedClientPage[],
  cities: Array<{ slug: string; approvedAt?: string; updatedAt?: string }>
): Array<{ loc: string; lastmod?: string }> {
  return [
    { loc: `${root}/` },
    ...pages.filter((p) => p.slug !== "home").map((p) => ({ loc: `${root}${p.path}` })),
    ...(cities.length ? [{ loc: `${root}/locations` }] : []),
    ...cities.map((c) => ({ loc: `${root}/locations/${c.slug}`, lastmod: c.approvedAt || c.updatedAt })),
  ];
}

export function sitemapXml(urls: Array<{ loc: string; lastmod?: string }>): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
}

/** Route handlers (sitemap/robots) cannot use notFound(): same checks as requireClientSite, as a result. */
export async function resolveClientRequest(
  hostParam: string,
  headerHost: string | null,
  stampedHost?: string | null
): Promise<{ kind: "ok"; site: ClientSite } | { kind: "redirect"; to: string } | { kind: "not_found" }> {
  const actual = requestClientHost(headerHost, stampedHost);
  const routed = normalizeHost(decodeURIComponent(hostParam));
  if (!routed) return { kind: "not_found" };
  if (actual && !sameClientDomain(actual, routed)) return { kind: "not_found" };
  if (!actual && !isLocalDevHost(headerHost)) return { kind: "not_found" };
  const site = await resolveClientDomain(routed);
  if (!site) return { kind: "not_found" };
  if (routed !== site.domain) return { kind: "redirect", to: `https://${site.domain}` };
  return { kind: "ok", site: { ...site, origin: `https://${site.domain}` } };
}
