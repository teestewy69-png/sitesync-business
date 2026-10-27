import { SCOPE_ANALYTICS, getServiceAccountToken, serviceAccountConfigured } from "./google-auth";

/**
 * Small GA4 Data API reader for the /app/seo card. Server-side only.
 * Needs GA4_PROPERTY_ID (numeric property id, NOT the G- measurement id) plus a service account
 * (GOOGLE_SERVICE_ACCOUNT_KEY_FILE) added to the GA4 property as Viewer.
 * Numbers are shown only when Google returns them; nothing is estimated or invented.
 */

export type GaTopPage = { path: string; sessions: number; keyEvents: number };

export type GaSummary =
  | { status: "not_connected"; missing: string[] }
  | { status: "error"; message: string }
  | {
      status: "ok";
      days: number;
      propertyId: string;
      fetchedAt: string;
      sessions: number;
      users: number;
      keyEvents: number;
      topPages: GaTopPage[];
    };

type GaRow = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
type GaReport = { rows?: GaRow[]; totals?: GaRow[] };

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function normalizePropertyId(raw: string | undefined): string {
  const cleaned = (raw || "").trim().replace(/^properties\//i, "");
  return /^\d{5,15}$/.test(cleaned) ? cleaned : "";
}

/** Metric order requested: sessions, totalUsers, keyEvents. */
export function parseGaReport(report: GaReport, days: number, propertyId: string, fetchedAt: string): GaSummary {
  const rows = report.rows || [];
  const totalRow = report.totals?.[0];
  const sum = (idx: number) => rows.reduce((acc, row) => acc + num(row.metricValues?.[idx]?.value), 0);
  const total = (idx: number) => (totalRow ? num(totalRow.metricValues?.[idx]?.value) : sum(idx));
  return {
    status: "ok",
    days,
    propertyId,
    fetchedAt,
    sessions: total(0),
    users: total(1),
    keyEvents: total(2),
    topPages: rows.slice(0, 5).map((row) => ({
      path: row.dimensionValues?.[0]?.value || "(not set)",
      sessions: num(row.metricValues?.[0]?.value),
      keyEvents: num(row.metricValues?.[2]?.value),
    })),
  };
}

export function gaMissing(env: NodeJS.ProcessEnv = process.env, keyFileOk = serviceAccountConfigured()): string[] {
  const missing: string[] = [];
  if (!normalizePropertyId(env.GA4_PROPERTY_ID)) missing.push("GA4_PROPERTY_ID");
  if (!keyFileOk) missing.push("GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
  return missing;
}

export type FetchGaDeps = {
  env?: NodeJS.ProcessEnv;
  keyFileOk?: boolean;
  getToken?: (scope: string) => Promise<string>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  days?: number;
};

export async function fetchGaSummary(deps: FetchGaDeps = {}): Promise<GaSummary> {
  const env = deps.env ?? process.env;
  const missing = gaMissing(env, deps.keyFileOk ?? serviceAccountConfigured());
  if (missing.length) return { status: "not_connected", missing };
  const propertyId = normalizePropertyId(env.GA4_PROPERTY_ID);
  const days = deps.days ?? 28;
  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const getToken = deps.getToken ?? getServiceAccountToken;
  const now = deps.now ?? (() => new Date());
  try {
    const token = await getToken(SCOPE_ANALYTICS);
    const res = await doFetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }],
        metricAggregations: ["TOTAL"],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 5,
      }),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 160);
      return { status: "error", message: `GA4 Data API returned ${res.status}. ${text}` };
    }
    return parseGaReport((await res.json()) as GaReport, days, propertyId, now().toISOString());
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "GA4 request failed." };
  }
}

let cached: { at: number; value: GaSummary } | null = null;
const CACHE_MS = 10 * 60_000;

/** fetchGaSummary with a 10-minute in-memory cache so reloading /app/seo does not spam Google. */
export async function loadGaSummary(): Promise<GaSummary> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  const value = await fetchGaSummary();
  if (value.status === "ok") cached = { at: now, value };
  return value;
}
