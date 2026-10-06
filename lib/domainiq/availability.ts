/**
 * Optional domain availability check - same free, keyless sources DomainIQ uses
 * (app/services/generation/registration_filter.py):
 *   - public RDAP (Verisign) : 404 => not registered, 200 => registered
 *   - public DNS over HTTPS (Cloudflare) NS lookup : NS records => registered
 * Only .com/.net have an RDAP endpoint wired (DomainIQ's default is .com).
 * Anything else, or any lookup failure, stays honest: `unsupported_tld` / `error`.
 * This never reserves or purchases a domain.
 */
import type { AvailabilityResult } from "./client";

const RDAP_BASE: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
};
const DNS_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const PARKING_HINTS = [
  "sedoparking", "afternic", "dan.com", "bodis", "parkingcrew", "above.com", "namefind",
  "hugedomains", "cashparking", "sav.com", "parklogic", "skenzo", "undeveloped", "dsredirection",
];

/** On by default (free + keyless). Set DOMAINIQ_AVAILABILITY=off to leave candidates `unchecked`. */
export function availabilityCheckingEnabled(): boolean {
  const flag = (process.env.DOMAINIQ_AVAILABILITY || "").trim().toLowerCase();
  return !(flag === "off" || flag === "0" || flag === "false" || flag === "disabled");
}

type FetchLike = typeof fetch;

async function withTimeout<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function rdapRegistered(domain: string, tld: string, fetchImpl: FetchLike, timeoutMs: number) {
  const base = RDAP_BASE[tld];
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetchImpl(`${base}${domain}`, { signal, headers: { accept: "application/rdap+json" } });
    if (res.status === 404) return false;
    if (res.status === 200) return true;
    throw new Error(`RDAP HTTP ${res.status}`);
  });
}

async function dnsNameservers(domain: string, fetchImpl: FetchLike, timeoutMs: number): Promise<string[]> {
  return withTimeout(timeoutMs, async (signal) => {
    const url = `${DNS_ENDPOINT}?name=${encodeURIComponent(domain)}&type=NS`;
    const res = await fetchImpl(url, { signal, headers: { accept: "application/dns-json" } });
    if (!res.ok) throw new Error(`DNS HTTP ${res.status}`);
    const payload = (await res.json()) as { Answer?: Array<{ type?: number | string; data?: string }> };
    return (payload.Answer || [])
      .filter((a) => String(a.type) === "2" || a.type === "NS")
      .map((a) => String(a.data || "").trim().toLowerCase().replace(/\.$/, ""));
  });
}

export async function checkDomainAvailability(
  rawDomain: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; now?: () => string } = {}
): Promise<AvailabilityResult> {
  const domain = rawDomain.trim().toLowerCase();
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const now = opts.now || (() => new Date().toISOString());
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (!RDAP_BASE[tld]) {
    return { domain, status: "unsupported_tld", checkedAt: now(), detail: `No keyless RDAP endpoint wired for .${tld}` };
  }
  const [dns, rdap] = await Promise.allSettled([
    dnsNameservers(domain, fetchImpl, timeoutMs),
    rdapRegistered(domain, tld, fetchImpl, timeoutMs),
  ]);
  const ns = dns.status === "fulfilled" ? dns.value : null;
  if (ns && ns.length) {
    const parked = PARKING_HINTS.some((hint) => ns.join(" ").includes(hint));
    return {
      domain,
      status: "registered",
      checkedAt: now(),
      detail: parked ? `Parked / for sale (NS ${ns[0]})` : `DNS NS published (${ns[0]})`,
    };
  }
  if (rdap.status === "fulfilled") {
    if (rdap.value) return { domain, status: "registered", checkedAt: now(), detail: "RDAP: registered" };
    if (ns) return { domain, status: "available", checkedAt: now(), detail: "RDAP 404 + no DNS NS records" };
    return { domain, status: "available", checkedAt: now(), detail: "RDAP 404 (DNS check failed)" };
  }
  const reason = rdap.reason instanceof Error ? rdap.reason.message : "lookup failed";
  return { domain, status: "error", checkedAt: now(), detail: `RDAP lookup failed: ${reason}` };
}

export async function checkDomainsAvailability(
  domains: string[],
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; concurrency?: number } = {}
): Promise<AvailabilityResult[]> {
  const unique = Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)));
  const results: AvailabilityResult[] = new Array(unique.length);
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await checkDomainAvailability(unique[index], opts);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return results;
}
