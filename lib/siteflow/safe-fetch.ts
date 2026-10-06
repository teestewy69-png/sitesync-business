/**
 * SSRF-safe HTTP(S) GET for crawling customer-supplied URLs (SEO audit).
 *  - http/https only, default ports only, no credentials in the URL, no localhost/.local/.internal names.
 *  - Every DNS answer is checked at connect time (custom `lookup`), so a hostname cannot resolve to a
 *    private, loopback, link-local, CGNAT, multicast or reserved address, including after a redirect
 *    and including DNS-rebinding between check and connect.
 *  - Redirects are followed manually (max 4) and re-validated; body size and time are capped.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
  "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15",
  "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

function expandV6(ip: string): number[] | null {
  let addr = ip.toLowerCase();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);
  let tail: number[] = [];
  const lastColon = addr.lastIndexOf(":");
  const maybeV4 = addr.slice(lastColon + 1);
  if (net.isIPv4(maybeV4)) {
    const n = v4ToInt(maybeV4);
    tail = [(n >>> 16) & 0xffff, n & 0xffff];
    addr = `${addr.slice(0, lastColon)}:${tail.length ? "0:0" : ""}`;
  }
  const [head, rest] = addr.split("::");
  const h = head ? head.split(":").filter(Boolean) : [];
  const r = rest !== undefined ? rest.split(":").filter(Boolean) : [];
  const fill = 8 - h.length - r.length;
  if (rest === undefined && h.length !== 8) return null;
  const groups = [...h, ...Array(Math.max(0, fill)).fill("0"), ...r].map((g) => parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isFinite(g))) return null;
  if (tail.length) {
    groups[6] = tail[0];
    groups[7] = tail[1];
  }
  return groups;
}

export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return BLOCKED_V4.some((cidr) => inV4(ip, cidr)) || ip === "255.255.255.255";
  if (!net.isIPv6(ip)) return true;
  const g = expandV6(ip);
  if (!g) return true;
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedAddress(embeddedV4()); // ::ffff:v4
  if (g.slice(0, 6).every((x) => x === 0)) return true; // ::v4 (deprecated compat)
  if (g[0] === 0x64 && g[1] === 0xff9b) return isBlockedAddress(embeddedV4()); // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  if (g[0] === 0x2002) return true; // 6to4
  return false;
}

/** Throws UnsafeUrlError for anything the crawler must not touch. */
export function assertSafeUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    throw new UnsafeUrlError("Not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Only http and https URLs can be audited.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed.");
  if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
    throw new UnsafeUrlError("Only the default web ports are allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host) throw new UnsafeUrlError("Missing host.");
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) {
    throw new UnsafeUrlError("Private hostnames are not allowed.");
  }
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError("Private or reserved addresses are not allowed.");
  } else if (!host.includes(".")) {
    throw new UnsafeUrlError("Single-label hostnames are not allowed.");
  }
  return url;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS lookup that refuses blocked addresses (used at socket connect time). */
export function safeLookup(hostname: string, options: { all?: boolean } | number, callback: LookupCb): void {
  const wantAll = typeof options === "object" && Boolean(options?.all);
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, wantAll ? [] : "");
    const list = (addresses || []) as LookupAddress[];
    if (!list.length) return callback(Object.assign(new Error("No DNS answer"), { code: "ENOTFOUND" }), wantAll ? [] : "");
    if (list.some((a) => isBlockedAddress(a.address))) {
      return callback(Object.assign(new UnsafeUrlError("Host resolves to a private or reserved address."), { code: "EBLOCKED" }), wantAll ? [] : "");
    }
    if (wantAll) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  body: string;
  ttfbMs: number;
  bytes: number;
  error: string;
  finalUrl: string;
  contentType: string;
};

function requestOnce(url: URL, timeoutMs: number, maxBytes: number): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer; ttfbMs: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: safeLookup as unknown as typeof dnsLookup,
        headers: {
          "user-agent": "SitesincSEOAudit/1.0 (+https://sitesinc.co)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5",
          "accept-encoding": "gzip, deflate, br",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const ttfbMs = Date.now() - started;
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
        else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks), ttfbMs });
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks), ttfbMs }));
        stream.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetchText(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const maxRedirects = opts.maxRedirects ?? 4;
  let url: URL;
  try {
    url = assertSafeUrl(raw);
  } catch (err) {
    return { ok: false, status: 0, body: "", ttfbMs: 0, bytes: 0, error: (err as Error).message, finalUrl: String(raw), contentType: "" };
  }
  const started = Date.now();
  for (let hop = 0; hop <= maxRedirects; hop++) {
    try {
      const res = await requestOnce(url, timeoutMs, maxBytes);
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        url = assertSafeUrl(new URL(String(res.headers.location), url));
        continue;
      }
      const body = res.body.toString("utf8");
      const ok = res.status >= 200 && res.status < 300;
      return {
        ok,
        status: res.status,
        body,
        ttfbMs: Date.now() - started,
        bytes: res.body.length,
        error: ok ? "" : `HTTP ${res.status}`,
        finalUrl: url.toString(),
        contentType: String(res.headers["content-type"] || ""),
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        body: "",
        ttfbMs: Date.now() - started,
        bytes: 0,
        error: err instanceof Error ? err.message : "Fetch failed",
        finalUrl: url.toString(),
        contentType: "",
      };
    }
  }
  return { ok: false, status: 0, body: "", ttfbMs: Date.now() - started, bytes: 0, error: "Too many redirects", finalUrl: url.toString(), contentType: "" };
}
