/**
 * Per-TLD first-year registration prices for the DomainIQ report, from Porkbun's
 * public price list (https://porkbun.com/products/domains) - the same public-list
 * approach the Domain Hunter uses. No API key: the pricing page is public HTML
 * whose featured TLD cards carry `data-tld="com"` + ".COM from $11.81".
 *
 * These are per-TLD LIST prices for a standard name, never a per-name quote:
 * registry-premium names cost more (sometimes far more) at checkout, and the
 * report labels them as estimates everywhere they appear.
 *
 * Live fetch first (short timeout, browser UA - the page bot-challenges bare
 * clients); on any failure or an unparseable page, fall back to the bundled
 * snapshot below, which is labeled with its date in the report.
 */

export const PORKBUN_PRICING_URL = "https://porkbun.com/products/domains";

/** Snapshot of Porkbun's public list, read from porkbun.com/products/domains on this date. */
export const PORKBUN_SNAPSHOT_DATE = "2026-11-08";
export const PORKBUN_PRICE_SNAPSHOT: Record<string, number> = {
  com: 11.81,
  net: 12.52,
  org: 7.98,
};

export type TldPriceTable = {
  /** tld (no dot, lowercase) -> first-year registration price in USD. */
  prices: Record<string, number>;
  source: "live" | "snapshot";
  /** YYYY-MM-DD the prices were fetched (live) or the snapshot date. */
  asOf: string;
};

type FetchLike = typeof fetch;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function withTimeout<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the featured-TLD cards on Porkbun's public pricing page:
 *   <a class="black priceDisplayHomeLink" data-tld="com" href="/tld/com"> .COM from $11.81 </a>
 * Returns {} when the markup does not match (page changed / challenge page).
 */
export function parsePorkbunPricingHtml(html: string): Record<string, number> {
  const prices: Record<string, number> = {};
  const pattern = /data-tld="([a-z0-9-]+)"[^>]*>\s*\.[A-Za-z0-9-]+\s+from\s+\$([0-9]+\.[0-9]{2})/g;
  for (const match of html.matchAll(pattern)) {
    const tld = match[1].toLowerCase();
    const price = Number(match[2]);
    if (Number.isFinite(price) && price > 0) prices[tld] = price;
  }
  return prices;
}

export async function getPorkbunTldPrices(
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; now?: () => Date } = {}
): Promise<TldPriceTable> {
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const now = opts.now || (() => new Date());
  try {
    const html = await withTimeout(timeoutMs, async (signal) => {
      const res = await fetchImpl(PORKBUN_PRICING_URL, {
        signal,
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": BROWSER_UA },
      });
      if (!res.ok) throw new Error(`Porkbun pricing HTTP ${res.status}`);
      return res.text();
    });
    const prices = parsePorkbunPricingHtml(html);
    // The featured cards always include .com; without it the page did not parse
    // (bot challenge or a redesign), so the snapshot is the honest fallback.
    if (typeof prices.com === "number") {
      return { prices, source: "live", asOf: now().toISOString().slice(0, 10) };
    }
  } catch {
    // fall through to the snapshot
  }
  return { prices: { ...PORKBUN_PRICE_SNAPSHOT }, source: "snapshot", asOf: PORKBUN_SNAPSHOT_DATE };
}

/** "$11.81" or undefined when the TLD is not in the table. */
export function formatTldPrice(table: TldPriceTable, tld: string): string | undefined {
  const price = table.prices[tld.toLowerCase()];
  return typeof price === "number" ? `$${price.toFixed(2)}` : undefined;
}
