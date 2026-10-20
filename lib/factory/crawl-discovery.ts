/**
 * Page discovery for baseline crawls (pure, no network). The crawler used to fetch only a fixed list of
 * paths (template seed + Sitesinc's own workspace pages + "/case-study"), so a client's real pages were never
 * found and Sitesinc paths 404'd on client sites. Discovery seeds from the sitemap and follows same-origin links.
 */

const SKIP_EXT = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|json|xml|txt|pdf|zip|woff2?|ttf|mp4|webm|mp3)$/i;
const SKIP_PREFIX = ["/_next/", "/api/", "/.netlify/", "/cdn-cgi/", "/static/"];

/** Normalize an absolute or relative href to a crawlable same-origin path, or "" if it should be skipped. */
export function crawlablePath(origin: string, href: string): string {
  let url: URL;
  let base: URL;
  try {
    base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
    url = new URL(href, base);
  } catch {
    return "";
  }
  if (url.origin !== base.origin) return "";
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  // Origins can carry a path prefix (client previews at /demo/client/<id>); keep paths relative to it.
  const prefix = base.pathname.replace(/\/$/, "");
  let path = url.pathname;
  if (prefix) {
    if (path !== prefix && !path.startsWith(`${prefix}/`)) return "";
    path = path.slice(prefix.length) || "/";
  }
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/$/, "");
  if (SKIP_EXT.test(path)) return "";
  if (SKIP_PREFIX.some((p) => path.startsWith(p))) return "";
  return path || "/";
}

/** Robots.txt Disallow rules for "*" (simple prefix matching; enough to avoid crawling blocked areas). */
export function robotsDisallows(robotsTxt: string): string[] {
  const out: string[] = [];
  let applies = false;
  for (const raw of String(robotsTxt || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") applies = value === "*";
    else if (key === "disallow" && applies && value) out.push(value);
  }
  return out;
}

export function isDisallowed(path: string, disallow: string[]): boolean {
  return disallow.some((rule) => rule !== "" && path.startsWith(rule.replace(/\*.*$/, "")));
}

/**
 * Collapse parameterised pages (e.g. /props/luka-doncic/points, /props/jokic/assists) so one dynamic template
 * cannot eat the whole crawl budget: at most `perGroup` paths per (first segment, depth) group.
 */
export function groupKey(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) return path;
  return `/${parts[0]}/*${parts.length}`;
}

export type DiscoveryQueue = {
  seen: Set<string>;
  queue: string[];
  groups: Map<string, number>;
};

export function newDiscovery(seeds: string[]): DiscoveryQueue {
  const q: DiscoveryQueue = { seen: new Set(), queue: [], groups: new Map() };
  for (const seed of seeds) enqueue(q, seed, Infinity);
  return q;
}

/** Add a path if new and its dynamic group has budget left. Returns true when queued. */
export function enqueue(q: DiscoveryQueue, path: string, perGroup = 3, disallow: string[] = []): boolean {
  if (!path || q.seen.has(path)) return false;
  if (isDisallowed(path, disallow)) return false;
  const key = groupKey(path);
  const used = q.groups.get(key) || 0;
  if (used >= perGroup) return false;
  q.groups.set(key, used + 1);
  q.seen.add(path);
  q.queue.push(path);
  return true;
}
