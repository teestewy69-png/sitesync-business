import { FACTORY_PROJECT_ID } from "./types";

/**
 * Client-safe types and period/math helpers for /app/website-data.
 * Keep Node-only Google clients out of this file so the dashboard bundle can import it.
 */

export const SITESINC_SITE_ID = "sitesinc";
export const WEBSITE_DATA_PRESETS = ["today", "7d", "30d", "90d"] as const;
export type WebsiteDataPreset = (typeof WEBSITE_DATA_PRESETS)[number] | "custom";

/** Trailing-12-month tracked purchase revenue × this multiple. Not an appraisal. */
export const ESTIMATED_VALUE_MULTIPLE = 2;
export const ESTIMATED_VALUE_FORMULA =
  "Last 12 months of GA4 purchaseRevenue × 2 (two years of observed revenue). Not an appraisal and not based on comparable sales.";

const MAX_RANGE_DAYS = 366;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type WebsiteDataSiteKind = "sitesinc" | "client" | "unknown";

export type WebsiteDataSiteOption = {
  id: string;
  name: string;
  kind: WebsiteDataSiteKind;
  ga4PropertyId: string;
  gscSiteUrl: string;
};

export type WebsiteDataMetric = {
  value: number | null;
  changePct: number | null;
  available: boolean;
  source: "ga4" | "gsc";
};

export type WebsiteDataRanked = { label: string; value: number; share: number };

export type WebsiteDataDaily = { date: string; users: number };

export type WebsiteDataEstimatedValue =
  | { status: "ok"; amount: number; formula: string; note: string }
  | { status: "placeholder"; amount: null; formula: string; note: string };

export type WebsiteDataReport = {
  site: WebsiteDataSiteOption;
  period: {
    preset: WebsiteDataPreset;
    start: string;
    end: string;
    priorStart: string;
    priorEnd: string;
    label: string;
    days: number;
  };
  sources: {
    ga4: "ok" | "not_connected" | "error";
    gsc: "ok" | "not_connected" | "error";
    ga4Message?: string;
    gscMessage?: string;
    missing: string[];
  };
  metrics: {
    visitors: WebsiteDataMetric;
    pageViews: WebsiteDataMetric;
    impressions: WebsiteDataMetric;
    clicks: WebsiteDataMetric;
    revenue: WebsiteDataMetric & { tracked: boolean };
  };
  dailyVisitors: WebsiteDataDaily[];
  topPages: WebsiteDataRanked[];
  topQueries: WebsiteDataRanked[];
  estimatedValue: WebsiteDataEstimatedValue;
  fetchedAt: string;
  live: boolean;
};

export type ClientAnalyticsFields = {
  id: string;
  businessName?: string;
  label?: string;
  ga4PropertyId?: string;
  gscSiteUrl?: string;
};

export function isDefaultSiteId(id?: string): boolean {
  return !id || id === SITESINC_SITE_ID || id === FACTORY_PROJECT_ID;
}

export function utcYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcYmd(d);
}

export function daysInclusive(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00.000Z`);
  const b = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function parseYmd(value: string | undefined): string {
  const raw = (value || "").trim();
  return YMD.test(raw) ? raw : "";
}

export function inferPreset(start: string, end: string, today: string): WebsiteDataPreset {
  if (start === today && end === today) return "today";
  if (start === addUtcDays(today, -6) && end === today) return "7d";
  if (start === addUtcDays(today, -29) && end === today) return "30d";
  if (start === addUtcDays(today, -89) && end === today) return "90d";
  return "custom";
}

export function formatPeriodLabel(preset: WebsiteDataPreset, start: string, end: string): string {
  if (preset === "today") return "Today";
  if (preset === "7d") return "Last 7 days";
  if (preset === "30d") return "Last 30 days";
  if (preset === "90d") return "Last 90 days";
  if (start === end) return start;
  return `${start} → ${end}`;
}

export type ResolvedPeriod =
  | { ok: true; start: string; end: string; priorStart: string; priorEnd: string; preset: WebsiteDataPreset; label: string; days: number }
  | { ok: false; error: string };

export function resolvePeriod(input: {
  preset?: string;
  from?: string;
  to?: string;
  today?: string;
}): ResolvedPeriod {
  const today = parseYmd(input.today) || utcYmd(new Date());
  const from = parseYmd(input.from);
  const to = parseYmd(input.to);
  const rawPreset = (input.preset || "").trim().toLowerCase();

  let start = "";
  let end = "";
  if (from && to) {
    start = from;
    end = to;
  } else if (rawPreset === "today" || rawPreset === "1" || rawPreset === "1d") {
    start = today;
    end = today;
  } else if (rawPreset === "7d" || rawPreset === "7") {
    start = addUtcDays(today, -6);
    end = today;
  } else if (rawPreset === "90d" || rawPreset === "90") {
    start = addUtcDays(today, -89);
    end = today;
  } else {
    start = addUtcDays(today, -29);
    end = today;
  }

  if (start > end) return { ok: false, error: "Start date must be on or before the end date." };
  const days = daysInclusive(start, end);
  if (days < 1 || days > MAX_RANGE_DAYS) {
    return { ok: false, error: `Pick a range of 1–${MAX_RANGE_DAYS} days.` };
  }

  const priorEnd = addUtcDays(start, -1);
  const priorStart = addUtcDays(priorEnd, -(days - 1));
  const preset = inferPreset(start, end, today);
  return {
    ok: true,
    start,
    end,
    priorStart,
    priorEnd,
    preset,
    label: formatPeriodLabel(preset, start, end),
    days,
  };
}

/** Percent change vs the prior period. null when the prior value is 0 and current is not (undefined %). */
export function percentChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}

export function rankedShares(rows: Array<{ label: string; value: number }>): WebsiteDataRanked[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    label: row.label,
    value: row.value,
    share: total > 0 ? row.value / total : 0,
  }));
}

export function formatGaDate(raw: string | undefined): string {
  const digits = (raw || "").replace(/-/g, "");
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return parseYmd(raw) || "";
}

export function sparklinePath(values: number[], width = 300, height = 90): { line: string; area: string } {
  if (!values.length) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const n = values.length;
  const pts = values.map((y, i) => {
    const x = n === 1 ? width / 2 : (i * width) / (n - 1);
    const py = height - 8 - (y / max) * (height - 16);
    return [x, py] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height}Z`;
  return { line, area };
}

export function estimateSiteValue(trailingYearRevenue: number | null): WebsiteDataEstimatedValue {
  if (trailingYearRevenue == null) {
    return {
      status: "placeholder",
      amount: null,
      formula: ESTIMATED_VALUE_FORMULA,
      note: "No estimate. GA4 purchase revenue is not available on this property, so there is no sound number to multiply.",
    };
  }
  if (!(trailingYearRevenue > 0)) {
    return {
      status: "placeholder",
      amount: null,
      formula: ESTIMATED_VALUE_FORMULA,
      note: "No estimate. GA4 has not recorded purchaseRevenue in the last 12 months, and this factory does not have comparable-sale data.",
    };
  }
  return {
    status: "ok",
    amount: trailingYearRevenue * ESTIMATED_VALUE_MULTIPLE,
    formula: ESTIMATED_VALUE_FORMULA,
    note: "All-time-style estimate from trailing 12-month tracked revenue. The period picker does not change it. Not an appraisal.",
  };
}
