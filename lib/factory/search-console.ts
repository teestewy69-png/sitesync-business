import { SCOPE_SEARCH_CONSOLE, getServiceAccountToken, serviceAccountConfigured } from "./google-auth";
import type { IndexingRecord, IndexingState } from "./types";

/** A credential exists: a manual access token (override) or a service-account key file. */
export function gscCredentialPresent(): boolean {
  return Boolean(process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN) || serviceAccountConfigured();
}

export function gscConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL) && gscCredentialPresent();
}

/**
 * Bearer token for Search Console. GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN wins when set (manual override,
 * you own its ~1 hour expiry). Otherwise a token is minted from the service account and cached/refreshed.
 */
export async function resolveGscToken(): Promise<string> {
  const manual = process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN;
  if (manual) return manual;
  return getServiceAccountToken(SCOPE_SEARCH_CONSOLE);
}

type Inspection = {
  state: IndexingState;
  source: string;
  lastChecked: string;
  notes: string;
};

export async function inspectUrl(url: string): Promise<Inspection> {
  const lastChecked = new Date().toISOString();
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || "";

  if (!siteUrl || !gscCredentialPresent()) {
    return {
      state: "not_submitted",
      source: "not_configured",
      lastChecked,
      notes:
        "Search Console is not configured. This URL is not marked indexed. Set GOOGLE_SEARCH_CONSOLE_SITE_URL plus GOOGLE_SERVICE_ACCOUNT_KEY_FILE (or GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN) to verify.",
    };
  }

  try {
    const token = await resolveGscToken();
    const res = await fetch(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: "en-US" }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        state: "excluded_error",
        source: "search_console",
        lastChecked,
        notes: `URL Inspection failed (${res.status}). ${text.slice(0, 180)}. Indexing is not assumed.`,
      };
    }
    const data = (await res.json()) as {
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          crawledAs?: string;
          indexingState?: string;
        };
      };
    };
    const status = data.inspectionResult?.indexStatusResult;
    const verdict = `${status?.verdict || ""} ${status?.coverageState || ""} ${status?.indexingState || ""}`.toLowerCase();
    let state: IndexingState = "discovered";
    if (verdict.includes("submitted") && !verdict.includes("index")) state = "submitted";
    if (verdict.includes("crawl")) state = "crawled";
    if (verdict.includes("indexed") && !verdict.includes("not indexed")) state = "indexed";
    if (verdict.includes("error") || verdict.includes("excluded") || verdict.includes("not indexed")) {
      state = "excluded_error";
    }
    return {
      state,
      source: "search_console",
      lastChecked,
      notes: status
        ? `GSC verdict=${status.verdict || "n/a"}; coverage=${status.coverageState || "n/a"}; indexing=${status.indexingState || "n/a"}.`
        : "Search Console returned no indexStatusResult.",
    };
  } catch (err) {
    return {
      state: "excluded_error",
      source: "search_console",
      lastChecked,
      notes: err instanceof Error ? err.message : "Inspection request failed.",
    };
  }
}

export function sitemapSubmission(record: IndexingRecord, inSitemap: boolean): IndexingRecord {
  const lastChecked = new Date().toISOString();
  if (record.state === "indexed" && record.source === "search_console") return record;
  if (inSitemap) {
    return {
      ...record,
      state: record.state === "not_submitted" ? "submitted" : record.state,
      lastChecked,
      source: record.source === "search_console" ? record.source : "sitemap",
      notes:
        record.state === "indexed"
          ? record.notes
          : "Listed in sitemap.xml. That is a submission signal only — not proof of indexing.",
    };
  }
  return {
    ...record,
    lastChecked,
    notes: `${record.notes} URL is not in the generated sitemap.`,
  };
}
