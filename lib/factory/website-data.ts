import { SCOPE_ANALYTICS, getServiceAccountToken, serviceAccountConfigured } from "./google-auth";
import { gaMissing, normalizePropertyId } from "./analytics-report";
import { resolveGscToken } from "./search-console";
import {
  addUtcDays,
  estimateSiteValue,
  formatGaDate,
  isDefaultSiteId,
  percentChange,
  rankedShares,
  resolvePeriod,
  SITESINC_SITE_ID,
  utcYmd,
  type ClientAnalyticsFields,
  type ResolvedPeriod,
  type WebsiteDataCollectedRevenue,
  type WebsiteDataDaily,
  type WebsiteDataEstimatedValue,
  type WebsiteDataMetric,
  type WebsiteDataQueryRow,
  type WebsiteDataReport,
  type WebsiteDataSiteOption,
} from "./website-data-model";

export * from "./website-data-model";

/**
 * Website data dashboard: real GA4 + Search Console numbers for a picked period.
 * Default property is sitesinc.co (GA4_PROPERTY_ID + GOOGLE_SEARCH_CONSOLE_SITE_URL).
 * A client project is used only when it has its own ga4PropertyId / gscSiteUrl —
 * Sitesinc's property is never borrowed.
 */

export type WebsiteDataDeps = {
  env?: NodeJS.ProcessEnv;
  keyFileOk?: boolean;
  getGaToken?: (scope: string) => Promise<string>;
  getGscToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  findProject?: (id: string) => Promise<ClientAnalyticsFields | null>;
  listProjects?: () => Promise<ClientAnalyticsFields[]>;
  readSiteflowRevenue?: () => Promise<SiteflowRevenueEntry[]>;
};

/** Minimal shape of a SiteFlow revenue-ledger entry (lib/siteflow/state.ts RevenueEntry). */
export type SiteflowRevenueEntry = {
  kind: "payment" | "refund";
  /** Positive for payments; negative for refunds (cumulative per charge). */
  amountCents: number;
  currency?: string;
  at: string;
  livemode: boolean;
};

type GaRow = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
type GaReport = { rows?: GaRow[]; totals?: GaRow[] };
type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type GscQueryResponse = { rows?: GscRow[] };

function num(v: string | number | undefined): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function gscMissing(
  siteUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  keyFileOk = serviceAccountConfigured()
): string[] {
  const missing: string[] = [];
  if (!siteUrl.trim()) missing.push("GOOGLE_SEARCH_CONSOLE_SITE_URL");
  if (!(env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN || "").trim() && !keyFileOk) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
  }
  return missing;
}

export function defaultSitesincSite(env: NodeJS.ProcessEnv = process.env): WebsiteDataSiteOption {
  return {
    id: SITESINC_SITE_ID,
    name: "sitesinc.co",
    kind: "sitesinc",
    ga4PropertyId: normalizePropertyId(env.GA4_PROPERTY_ID),
    gscSiteUrl: (env.GOOGLE_SEARCH_CONSOLE_SITE_URL || "").trim(),
  };
}

export function siteFromClient(project: ClientAnalyticsFields): WebsiteDataSiteOption {
  return {
    id: project.id,
    name: project.businessName || project.label || project.id,
    kind: "client",
    ga4PropertyId: normalizePropertyId(project.ga4PropertyId),
    gscSiteUrl: (project.gscSiteUrl || "").trim(),
  };
}

async function defaultFindProject(id: string): Promise<ClientAnalyticsFields | null> {
  const { findProjectById } = await import("@/lib/store");
  return findProjectById(id);
}

async function defaultListProjects(): Promise<ClientAnalyticsFields[]> {
  const { listProjects } = await import("@/lib/store");
  return listProjects();
}

/**
 * Default SiteFlow ledger read. SiteFlow keeps its state in the shared document
 * store (lib/persistence) under `siteflow/` keys — the same store this factory
 * reads elsewhere — so the revenue entries at `siteflow/revenue/*` are read
 * through it directly, mirroring listValues() in lib/siteflow/state.ts.
 */
async function defaultReadSiteflowRevenue(): Promise<SiteflowRevenueEntry[]> {
  const { listDocKeys, readDoc } = await import("@/lib/persistence");
  const keys = (await listDocKeys("siteflow/revenue")).sort().slice(-10000);
  const out: SiteflowRevenueEntry[] = [];
  for (const key of keys) {
    const doc = await readDoc<SiteflowRevenueEntry>(key);
    if (doc?.value) out.push(doc.value);
  }
  return out;
}

/**
 * Net live-mode Stripe money collected through SiteFlow inside [start, end]
 * (UTC days, inclusive), in dollars. Ledger refunds are stored as negative
 * entries, so summing nets them out; test-mode entries never count.
 */
export function sumCollectedRevenue(entries: SiteflowRevenueEntry[], start: string, end: string): number {
  let cents = 0;
  for (const entry of entries) {
    if (!entry.livemode) continue;
    if (entry.currency && entry.currency.toLowerCase() !== "usd") continue;
    const day = (entry.at || "").slice(0, 10);
    if (!day || day < start || day > end) continue;
    cents += entry.amountCents || 0;
  }
  return cents / 100;
}

/** Collected-revenue overlay for the sitesinc site. Any read failure degrades to null — never breaks the report. */
async function fetchCollectedRevenue(
  period: Extract<ResolvedPeriod, { ok: true }>,
  deps: WebsiteDataDeps
): Promise<WebsiteDataCollectedRevenue | null> {
  try {
    const read = deps.readSiteflowRevenue ?? defaultReadSiteflowRevenue;
    const entries = await read();
    return {
      amount: sumCollectedRevenue(entries, period.start, period.end),
      priorAmount: sumCollectedRevenue(entries, period.priorStart, period.priorEnd),
      start: period.start,
      end: period.end,
    };
  } catch {
    return null;
  }
}

export async function resolveWebsiteDataSite(
  siteId: string | undefined,
  deps: WebsiteDataDeps = {}
): Promise<WebsiteDataSiteOption> {
  const env = deps.env ?? process.env;
  if (isDefaultSiteId(siteId) || !siteId) return defaultSitesincSite(env);
  const findProject = deps.findProject ?? defaultFindProject;
  try {
    const project = await findProject(siteId);
    if (!project) return { id: siteId, name: siteId, kind: "unknown", ga4PropertyId: "", gscSiteUrl: "" };
    return siteFromClient(project);
  } catch {
    return { id: siteId, name: siteId, kind: "unknown", ga4PropertyId: "", gscSiteUrl: "" };
  }
}

export async function listWebsiteDataSites(deps: WebsiteDataDeps = {}): Promise<WebsiteDataSiteOption[]> {
  const env = deps.env ?? process.env;
  const sites: WebsiteDataSiteOption[] = [defaultSitesincSite(env)];
  const list = deps.listProjects ?? defaultListProjects;
  try {
    for (const project of await list()) {
      const site = siteFromClient(project);
      if (site.ga4PropertyId || site.gscSiteUrl) sites.push(site);
    }
  } catch {
    // Store down: still return the default Sitesinc property.
  }
  return sites;
}

export function parseGaRangeTotals(report: GaReport | undefined): { current: number[]; prior: number[] } {
  const current = [0, 0, 0];
  const prior = [0, 0, 0];
  for (const row of report?.rows || []) {
    const name = (row.dimensionValues?.[0]?.value || "").toLowerCase();
    const metrics = [0, 1, 2].map((i) => num(row.metricValues?.[i]?.value));
    if (name.includes("prior") || name.includes("date_range_1")) metrics.forEach((v, i) => (prior[i] = v));
    else metrics.forEach((v, i) => (current[i] = v));
  }
  if (!(report?.rows || []).length && report?.totals?.length) {
    const totals = report.totals[0];
    [0, 1, 2].forEach((i) => (current[i] = num(totals.metricValues?.[i]?.value)));
  }
  return { current, prior };
}

export function parseGaDaily(report: GaReport | undefined): WebsiteDataDaily[] {
  return (report?.rows || [])
    .map((row) => ({
      date: formatGaDate(row.dimensionValues?.[0]?.value),
      users: num(row.metricValues?.[0]?.value),
    }))
    .filter((row) => row.date);
}

export function parseGaTopPages(report: GaReport | undefined): Array<{ label: string; value: number }> {
  return (report?.rows || []).map((row) => ({
    label: row.dimensionValues?.[0]?.value || "(not set)",
    value: num(row.metricValues?.[0]?.value),
  }));
}

/**
 * Key-event totals out of the two-range totals report. keyEvents sits after the
 * always-present users/pageviews metrics, so its index shifts when the optional
 * purchaseRevenue metric is dropped from the request (3 with it, 2 without).
 */
export function parseGaKeyEvents(
  report: GaReport | undefined,
  metricIndex = 3
): { current: number; prior: number } {
  let current = 0;
  let prior = 0;
  for (const row of report?.rows || []) {
    const name = (row.dimensionValues?.[0]?.value || "").toLowerCase();
    const value = num(row.metricValues?.[metricIndex]?.value);
    if (name.includes("prior") || name.includes("date_range_1")) prior = value;
    else current = value;
  }
  if (!(report?.rows || []).length && report?.totals?.length) {
    current = num(report.totals[0].metricValues?.[metricIndex]?.value);
  }
  return { current, prior };
}

export function parseGaTopEvents(report: GaReport | undefined): Array<{ label: string; value: number }> {
  return (report?.rows || []).map((row) => ({
    label: row.dimensionValues?.[0]?.value || "(not set)",
    value: num(row.metricValues?.[0]?.value),
  }));
}

/** Session channel groups by totalUsers — where the visitors came from (Rec #3). */
export function parseGaTopChannels(report: GaReport | undefined): Array<{ label: string; value: number }> {
  return (report?.rows || []).map((row) => ({
    label: row.dimensionValues?.[0]?.value || "(not set)",
    value: num(row.metricValues?.[0]?.value),
  }));
}

/**
 * Cities by totalUsers — which towns the visitors are in (Rec #3). GA4 reports
 * visits it cannot place as "(not set)"; those rows (and empty labels) are not
 * towns, so they are dropped BEFORE rankedShares computes shares, and the list
 * is capped at 8 after the wider fetch (limit 10) absorbs the filtering.
 */
export function parseGaTopCities(report: GaReport | undefined): Array<{ label: string; value: number }> {
  return (report?.rows || [])
    .map((row) => ({
      label: (row.dimensionValues?.[0]?.value || "").trim(),
      value: num(row.metricValues?.[0]?.value),
    }))
    .filter((row) => row.label && row.label !== "(not set)")
    .slice(0, 8);
}

export function parseGscTotals(data: GscQueryResponse | undefined): { clicks: number; impressions: number } {
  const row = data?.rows?.[0];
  return { clicks: num(row?.clicks), impressions: num(row?.impressions) };
}

/**
 * Site-wide CTR + average position from the same totals row parseGscTotals
 * reads — the Search Console response already carries both fields (the API's
 * values are impression-weighted; never average per-query positions instead).
 * Kept as a separate parser so the totals shape above stays untouched.
 */
export function parseGscRates(data: GscQueryResponse | undefined): { ctr: number; position: number } {
  const row = data?.rows?.[0];
  return { ctr: num(row?.ctr), position: num(row?.position) };
}

export function parseGscQueries(data: GscQueryResponse | undefined): Array<{ label: string; value: number }> {
  return (data?.rows || []).map((row) => ({
    label: row.keys?.[0] || "(not set)",
    value: num(row.clicks),
  }));
}

/** Top queries with full depth, in the API's click-ranked order; share is each query's share of the listed clicks. */
export function parseGscQueryRows(data: GscQueryResponse | undefined): WebsiteDataQueryRow[] {
  const rows = (data?.rows || []).map((row) => ({
    label: row.keys?.[0] || "(not set)",
    clicks: num(row.clicks),
    impressions: num(row.impressions),
    ctr: num(row.ctr),
    position: num(row.position),
  }));
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  return rows.map((row) => ({ ...row, share: totalClicks > 0 ? row.clicks / totalClicks : 0 }));
}

function publicPeriod(period: Extract<ResolvedPeriod, { ok: true }>): WebsiteDataReport["period"] {
  return {
    start: period.start,
    end: period.end,
    priorStart: period.priorStart,
    priorEnd: period.priorEnd,
    preset: period.preset,
    label: period.label,
    days: period.days,
  };
}

function emptyMetric(source: "ga4" | "gsc"): WebsiteDataMetric {
  return { value: null, changePct: null, available: false, source };
}

function metric(current: number, prior: number, source: "ga4" | "gsc"): WebsiteDataMetric {
  return { value: current, changePct: percentChange(current, prior), available: true, source };
}

function emptyReport(
  site: WebsiteDataSiteOption,
  period: Extract<ResolvedPeriod, { ok: true }>,
  fetchedAt: string,
  sources: WebsiteDataReport["sources"],
  estimatedValue: WebsiteDataEstimatedValue
): WebsiteDataReport {
  return {
    site,
    period: publicPeriod(period),
    sources,
    metrics: {
      conversions: { ...emptyMetric("ga4"), tracked: false },
      visitors: emptyMetric("ga4"),
      pageViews: emptyMetric("ga4"),
      impressions: emptyMetric("gsc"),
      clicks: emptyMetric("gsc"),
      ctr: emptyMetric("gsc"),
      position: { ...emptyMetric("gsc"), lowerIsBetter: true },
      revenue: { ...emptyMetric("ga4"), tracked: false },
    },
    dailyVisitors: [],
    topPages: [],
    topQueries: [],
    queryRows: [],
    topEvents: [],
    topChannels: [],
    topCities: [],
    collectedRevenue: null,
    estimatedValue,
    fetchedAt,
    live: false,
  };
}

type SourceResult<T> =
  | { status: "ok"; value: T }
  | { status: "not_connected"; missing: string[] }
  | { status: "error"; message: string };

async function fetchGaWebsite(
  site: WebsiteDataSiteOption,
  period: Extract<ResolvedPeriod, { ok: true }>,
  deps: WebsiteDataDeps
): Promise<
  SourceResult<{
    users: number;
    priorUsers: number;
    pageViews: number;
    priorPageViews: number;
    revenue: number | null;
    priorRevenue: number | null;
    conversions: number | null;
    priorConversions: number | null;
    daily: WebsiteDataDaily[];
    topPages: Array<{ label: string; value: number }>;
    topEvents: Array<{ label: string; value: number }>;
    topChannels: Array<{ label: string; value: number }>;
    topCities: Array<{ label: string; value: number }>;
    trailingYearRevenue: number | null;
  }>
> {
  const env = deps.env ?? process.env;
  const keyFileOk = deps.keyFileOk ?? serviceAccountConfigured();
  const missing =
    site.kind === "sitesinc"
      ? gaMissing(env, keyFileOk)
      : [
          ...(!site.ga4PropertyId ? ["ga4PropertyId"] : []),
          ...(!keyFileOk ? ["GOOGLE_SERVICE_ACCOUNT_KEY_FILE"] : []),
        ];
  if (missing.length) return { status: "not_connected", missing };

  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const getToken = deps.getGaToken ?? getServiceAccountToken;
  const yearStart = addUtcDays(period.end, -364);

  const totalsDateRanges = [
    { startDate: period.start, endDate: period.end, name: "current" },
    { startDate: period.priorStart, endDate: period.priorEnd, name: "prior" },
  ];
  const dailyRequest = {
    dateRanges: [{ startDate: period.start, endDate: period.end }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "totalUsers" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 400,
  };
  const pagesRequest = {
    dateRanges: [{ startDate: period.start, endDate: period.end }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 8,
  };
  const yearRequest = {
    dateRanges: [{ startDate: yearStart, endDate: period.end }],
    metrics: [{ name: "purchaseRevenue" }],
  };
  const eventsRequest = {
    dateRanges: [{ startDate: period.start, endDate: period.end }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "keyEvents" }],
    orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }],
    limit: 8,
  };
  // Rec #3 breakdowns. Both use totalUsers so the numbers stay consistent with
  // the tab's Visitors framing (a visitor counted once, in one channel and one
  // city). Cities fetch 10 rows so dropping the "(not set)" rows in the parser
  // does not starve the 8-row list.
  const channelsRequest = {
    dateRanges: [{ startDate: period.start, endDate: period.end }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 8,
  };
  const citiesRequest = {
    dateRanges: [{ startDate: period.start, endDate: period.end }],
    dimensions: [{ name: "city" }],
    metrics: [{ name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 10,
  };

  async function run(
    includeRevenue: boolean,
    includeKeyEvents: boolean,
    includeBreakdowns: boolean
  ): Promise<{ ok: true; reports: GaReport[] } | { ok: false; status: number; text: string }> {
    const token = await getToken(SCOPE_ANALYTICS);
    const totalsRequest = {
      dateRanges: totalsDateRanges,
      metrics: [
        { name: "totalUsers" },
        { name: "screenPageViews" },
        ...(includeRevenue ? [{ name: "purchaseRevenue" }] : []),
        ...(includeKeyEvents ? [{ name: "keyEvents" }] : []),
      ],
    };
    const requests = [
      totalsRequest,
      dailyRequest,
      pagesRequest,
      ...(includeRevenue ? [yearRequest] : []),
      ...(includeKeyEvents ? [eventsRequest] : []),
      ...(includeBreakdowns ? [channelsRequest, citiesRequest] : []),
    ];
    const res = await doFetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${site.ga4PropertyId}:batchRunReports`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
    if (!res.ok) return { ok: false, status: res.status, text: (await res.text()).slice(0, 180) };
    const body = (await res.json()) as { reports?: GaReport[] };
    return { ok: true, reports: body.reports || [] };
  }

  try {
    // Optional metrics degrade independently, exactly like purchaseRevenue always has:
    // a property that rejects keyEvents retries without it (conversions untracked),
    // and a property that rejects purchaseRevenue retries without it — never failing
    // the whole report over an optional metric. The Rec #3 breakdown requests
    // (channels/cities) degrade the same way: additive only, so a failure that
    // implicates one of their dimensions retries without both and the two new
    // cards render empty while the core report stands.
    let includeRevenue = true;
    let includeKeyEvents = true;
    let includeBreakdowns = true;
    const implicatesBreakdown = (text: string) => /sessionDefaultChannelGroup|\bcity\b/i.test(text);
    let batch = await run(true, true, true);
    if (!batch.ok && /keyEvents/i.test(batch.text)) {
      includeKeyEvents = false;
      batch = await run(includeRevenue, false, includeBreakdowns);
    }
    if (!batch.ok && implicatesBreakdown(batch.text)) {
      includeBreakdowns = false;
      batch = await run(includeRevenue, includeKeyEvents, false);
    }
    if (!batch.ok && /purchaseRevenue|INVALID_ARGUMENT/i.test(batch.text)) {
      includeRevenue = false;
      batch = await run(false, includeKeyEvents, includeBreakdowns);
      if (!batch.ok && includeKeyEvents) {
        // The generic INVALID_ARGUMENT may have been about keyEvents after all.
        includeKeyEvents = false;
        batch = await run(false, false, includeBreakdowns);
      }
      if (!batch.ok && includeBreakdowns) {
        // Last resort: it may have been about a breakdown dimension after all.
        includeBreakdowns = false;
        batch = await run(false, false, false);
      }
    }
    if (!batch.ok) return { status: "error", message: `GA4 Data API returned ${batch.status}. ${batch.text}` };
    const [totals, daily, pages] = batch.reports;
    let cursor = 3;
    const year = includeRevenue ? batch.reports[cursor++] : undefined;
    const events = includeKeyEvents ? batch.reports[cursor++] : undefined;
    const channels = includeBreakdowns ? batch.reports[cursor++] : undefined;
    const cities = includeBreakdowns ? batch.reports[cursor] : undefined;
    const parsed = parseGaRangeTotals(totals);
    const keyEvents = includeKeyEvents ? parseGaKeyEvents(totals, includeRevenue ? 3 : 2) : null;
    const yearRevenue = includeRevenue ? num(year?.rows?.[0]?.metricValues?.[0]?.value ?? year?.totals?.[0]?.metricValues?.[0]?.value) : null;
    return {
      status: "ok",
      value: {
        users: parsed.current[0],
        priorUsers: parsed.prior[0],
        pageViews: parsed.current[1],
        priorPageViews: parsed.prior[1],
        revenue: includeRevenue ? parsed.current[2] : null,
        priorRevenue: includeRevenue ? parsed.prior[2] : null,
        conversions: keyEvents ? keyEvents.current : null,
        priorConversions: keyEvents ? keyEvents.prior : null,
        daily: parseGaDaily(daily),
        topPages: parseGaTopPages(pages),
        topEvents: includeKeyEvents ? parseGaTopEvents(events) : [],
        topChannels: includeBreakdowns ? parseGaTopChannels(channels) : [],
        topCities: includeBreakdowns ? parseGaTopCities(cities) : [],
        trailingYearRevenue: yearRevenue,
      },
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "GA4 request failed." };
  }
}

async function fetchGscWebsite(
  site: WebsiteDataSiteOption,
  period: Extract<ResolvedPeriod, { ok: true }>,
  deps: WebsiteDataDeps
): Promise<
  SourceResult<{
    clicks: number;
    priorClicks: number;
    impressions: number;
    priorImpressions: number;
    ctr: number;
    priorCtr: number;
    position: number;
    priorPosition: number;
    queries: Array<{ label: string; value: number }>;
    queryRows: WebsiteDataQueryRow[];
  }>
> {
  const env = deps.env ?? process.env;
  const keyFileOk = deps.keyFileOk ?? serviceAccountConfigured();
  const missing = gscMissing(site.gscSiteUrl, env, keyFileOk);
  if (site.kind !== "sitesinc") {
    const idx = missing.indexOf("GOOGLE_SEARCH_CONSOLE_SITE_URL");
    if (idx >= 0) missing[idx] = "gscSiteUrl";
  }
  if (missing.length) return { status: "not_connected", missing };

  const doFetch = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const getToken = deps.getGscToken ?? resolveGscToken;

  async function query(startDate: string, endDate: string, dimensions?: string[]): Promise<{ ok: true; data: GscQueryResponse } | { ok: false; status: number; text: string }> {
    const token = await getToken();
    const encoded = encodeURIComponent(site.gscSiteUrl);
    const res = await doFetch(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: dimensions || [],
        rowLimit: dimensions ? 8 : 1,
        aggregationType: "auto",
      }),
    });
    if (!res.ok) return { ok: false, status: res.status, text: (await res.text()).slice(0, 180) };
    return { ok: true, data: (await res.json()) as GscQueryResponse };
  }

  try {
    const [current, prior, queries] = await Promise.all([
      query(period.start, period.end),
      query(period.priorStart, period.priorEnd),
      query(period.start, period.end, ["query"]),
    ]);
    if (!current.ok) return { status: "error", message: `Search Console returned ${current.status}. ${current.text}` };
    if (!prior.ok) return { status: "error", message: `Search Console returned ${prior.status}. ${prior.text}` };
    const currentTotals = parseGscTotals(current.data);
    const priorTotals = parseGscTotals(prior.data);
    const currentRates = parseGscRates(current.data);
    const priorRates = parseGscRates(prior.data);
    return {
      status: "ok",
      value: {
        clicks: currentTotals.clicks,
        priorClicks: priorTotals.clicks,
        impressions: currentTotals.impressions,
        priorImpressions: priorTotals.impressions,
        ctr: currentRates.ctr,
        priorCtr: priorRates.ctr,
        position: currentRates.position,
        priorPosition: priorRates.position,
        queries: queries.ok ? parseGscQueries(queries.data) : [],
        queryRows: queries.ok ? parseGscQueryRows(queries.data) : [],
      },
    };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Search Console request failed." };
  }
}

export async function buildWebsiteDataReport(
  input: { siteId?: string; preset?: string; from?: string; to?: string } = {},
  deps: WebsiteDataDeps = {}
): Promise<WebsiteDataReport | { error: string }> {
  const now = deps.now ?? (() => new Date());
  const fetchedAt = now().toISOString();
  const period = resolvePeriod({ ...input, today: utcYmd(now()) });
  if (!period.ok) return { error: period.error };

  const site = await resolveWebsiteDataSite(input.siteId, deps);
  if (site.kind === "unknown") {
    return emptyReport(site, period, fetchedAt, {
      ga4: "not_connected",
      gsc: "not_connected",
      missing: [],
      ga4Message: "Unknown site. Defaulting was not applied — Sitesinc data is not shown for an unknown client.",
      gscMessage: "Unknown site.",
    }, estimateSiteValue(null));
  }
  if (site.kind === "client" && !site.ga4PropertyId && !site.gscSiteUrl) {
    return emptyReport(site, period, fetchedAt, {
      ga4: "not_connected",
      gsc: "not_connected",
      missing: ["ga4PropertyId", "gscSiteUrl"],
      ga4Message: "This client has no GA4 property id. Sitesinc's property is not used.",
      gscMessage: "This client has no Search Console URL. Sitesinc's property is not used.",
    }, estimateSiteValue(null));
  }

  const [ga, gsc, collectedRevenue] = await Promise.all([
    fetchGaWebsite(site, period, deps),
    fetchGscWebsite(site, period, deps),
    site.kind === "sitesinc" ? fetchCollectedRevenue(period, deps) : Promise.resolve(null),
  ]);
  const missing = [
    ...(ga.status === "not_connected" ? ga.missing : []),
    ...(gsc.status === "not_connected" ? gsc.missing : []),
  ].filter((item, i, all) => all.indexOf(item) === i);

  const estimated = estimateSiteValue(ga.status === "ok" ? ga.value.trailingYearRevenue : null);
  const report: WebsiteDataReport = {
    site,
    period: publicPeriod(period),
    sources: {
      ga4: ga.status,
      gsc: gsc.status,
      ga4Message: ga.status === "error" ? ga.message : ga.status === "not_connected" ? `Missing: ${ga.missing.join(", ")}` : undefined,
      gscMessage: gsc.status === "error" ? gsc.message : gsc.status === "not_connected" ? `Missing: ${gsc.missing.join(", ")}` : undefined,
      missing,
    },
    metrics: {
      conversions:
        ga.status === "ok" && ga.value.conversions != null
          ? { ...metric(ga.value.conversions, ga.value.priorConversions || 0, "ga4"), tracked: true }
          : { ...emptyMetric("ga4"), tracked: false },
      visitors: ga.status === "ok" ? metric(ga.value.users, ga.value.priorUsers, "ga4") : emptyMetric("ga4"),
      pageViews: ga.status === "ok" ? metric(ga.value.pageViews, ga.value.priorPageViews, "ga4") : emptyMetric("ga4"),
      impressions: gsc.status === "ok" ? metric(gsc.value.impressions, gsc.value.priorImpressions, "gsc") : emptyMetric("gsc"),
      clicks: gsc.status === "ok" ? metric(gsc.value.clicks, gsc.value.priorClicks, "gsc") : emptyMetric("gsc"),
      ctr: gsc.status === "ok" ? metric(gsc.value.ctr, gsc.value.priorCtr, "gsc") : emptyMetric("gsc"),
      position:
        gsc.status === "ok"
          ? { ...metric(gsc.value.position, gsc.value.priorPosition, "gsc"), lowerIsBetter: true }
          : { ...emptyMetric("gsc"), lowerIsBetter: true },
      revenue:
        ga.status === "ok" && ga.value.revenue != null
          ? { ...metric(ga.value.revenue, ga.value.priorRevenue || 0, "ga4"), tracked: true }
          : { ...emptyMetric("ga4"), tracked: false },
    },
    dailyVisitors: ga.status === "ok" ? ga.value.daily : [],
    topPages: ga.status === "ok" ? rankedShares(ga.value.topPages) : [],
    topQueries: gsc.status === "ok" ? rankedShares(gsc.value.queries) : [],
    queryRows: gsc.status === "ok" ? gsc.value.queryRows : [],
    topEvents: ga.status === "ok" ? rankedShares(ga.value.topEvents) : [],
    topChannels: ga.status === "ok" ? rankedShares(ga.value.topChannels) : [],
    topCities: ga.status === "ok" ? rankedShares(ga.value.topCities) : [],
    collectedRevenue,
    estimatedValue: estimated,
    fetchedAt,
    live: ga.status === "ok" || gsc.status === "ok",
  };
  return report;
}

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: WebsiteDataReport }>();

export function websiteDataCacheKey(input: { siteId?: string; preset?: string; from?: string; to?: string; today?: string }): string {
  return [input.siteId || SITESINC_SITE_ID, input.preset || "", input.from || "", input.to || "", input.today || ""].join("|");
}

export function clearWebsiteDataCache() {
  cache.clear();
}

/** Cached loader for the page and API. Errors and not-connected states are not cached. */
export async function loadWebsiteData(
  input: { siteId?: string; preset?: string; from?: string; to?: string } = {},
  deps: WebsiteDataDeps = {}
): Promise<WebsiteDataReport | { error: string }> {
  const today = utcYmd((deps.now ?? (() => new Date()))());
  const key = websiteDataCacheKey({ ...input, today });
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return hit.value;
  const value = await buildWebsiteDataReport(input, deps);
  if (!("error" in value) && value.live) cache.set(key, { at: now, value });
  return value;
}
