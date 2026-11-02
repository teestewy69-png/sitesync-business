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
  type WebsiteDataDaily,
  type WebsiteDataEstimatedValue,
  type WebsiteDataMetric,
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

export function parseGscTotals(data: GscQueryResponse | undefined): { clicks: number; impressions: number } {
  const row = data?.rows?.[0];
  return { clicks: num(row?.clicks), impressions: num(row?.impressions) };
}

export function parseGscQueries(data: GscQueryResponse | undefined): Array<{ label: string; value: number }> {
  return (data?.rows || []).map((row) => ({
    label: row.keys?.[0] || "(not set)",
    value: num(row.clicks),
  }));
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
      visitors: emptyMetric("ga4"),
      pageViews: emptyMetric("ga4"),
      impressions: emptyMetric("gsc"),
      clicks: emptyMetric("gsc"),
      revenue: { ...emptyMetric("ga4"), tracked: false },
    },
    dailyVisitors: [],
    topPages: [],
    topQueries: [],
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
    daily: WebsiteDataDaily[];
    topPages: Array<{ label: string; value: number }>;
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

  const totalsRequest = {
    dateRanges: [
      { startDate: period.start, endDate: period.end, name: "current" },
      { startDate: period.priorStart, endDate: period.priorEnd, name: "prior" },
    ],
    metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }, { name: "purchaseRevenue" }],
  };
  const totalsNoRevenue = {
    ...totalsRequest,
    metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
  };
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

  async function run(includeRevenue: boolean): Promise<{ ok: true; reports: GaReport[] } | { ok: false; status: number; text: string }> {
    const token = await getToken(SCOPE_ANALYTICS);
    const requests = includeRevenue
      ? [totalsRequest, dailyRequest, pagesRequest, yearRequest]
      : [totalsNoRevenue, dailyRequest, pagesRequest];
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
    let includeRevenue = true;
    let batch = await run(true);
    if (!batch.ok && /purchaseRevenue|INVALID_ARGUMENT/i.test(batch.text)) {
      includeRevenue = false;
      batch = await run(false);
    }
    if (!batch.ok) return { status: "error", message: `GA4 Data API returned ${batch.status}. ${batch.text}` };
    const [totals, daily, pages, year] = batch.reports;
    const parsed = parseGaRangeTotals(totals);
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
        daily: parseGaDaily(daily),
        topPages: parseGaTopPages(pages),
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
    queries: Array<{ label: string; value: number }>;
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
    return {
      status: "ok",
      value: {
        clicks: currentTotals.clicks,
        priorClicks: priorTotals.clicks,
        impressions: currentTotals.impressions,
        priorImpressions: priorTotals.impressions,
        queries: queries.ok ? parseGscQueries(queries.data) : [],
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

  const [ga, gsc] = await Promise.all([fetchGaWebsite(site, period, deps), fetchGscWebsite(site, period, deps)]);
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
      visitors: ga.status === "ok" ? metric(ga.value.users, ga.value.priorUsers, "ga4") : emptyMetric("ga4"),
      pageViews: ga.status === "ok" ? metric(ga.value.pageViews, ga.value.priorPageViews, "ga4") : emptyMetric("ga4"),
      impressions: gsc.status === "ok" ? metric(gsc.value.impressions, gsc.value.priorImpressions, "gsc") : emptyMetric("gsc"),
      clicks: gsc.status === "ok" ? metric(gsc.value.clicks, gsc.value.priorClicks, "gsc") : emptyMetric("gsc"),
      revenue:
        ga.status === "ok" && ga.value.revenue != null
          ? { ...metric(ga.value.revenue, ga.value.priorRevenue || 0, "ga4"), tracked: true }
          : { ...emptyMetric("ga4"), tracked: false },
    },
    dailyVisitors: ga.status === "ok" ? ga.value.daily : [],
    topPages: ga.status === "ok" ? rankedShares(ga.value.topPages) : [],
    topQueries: gsc.status === "ok" ? rankedShares(gsc.value.queries) : [],
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
