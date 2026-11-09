import {
  formatRatePct,
  type WebsiteDataMetric,
  type WebsiteDataRanked,
  type WebsiteDataReport,
} from "./website-data-model";

/**
 * Client-facing monthly report for one Website Data report (Rec #4).
 *
 * Pure renderer: a WebsiteDataReport in, a standalone print-friendly HTML
 * document out. No I/O, so it is unit-testable and the factory route handler
 * (app/api/factory/website-data/report) is a thin gate + download wrapper.
 *
 * Deliberate exclusions: the report's estimatedValue (trailing-year GA4
 * revenue × 2) is an internal flip metric and never appears here — a client
 * deliverable shows what their site did, not what the factory guesses it is
 * worth. Stripe collected revenue (SiteFlow) is shown for the sitesinc site
 * only, as its own clearly labeled row, never merged into the GA4 revenue row.
 */

/** Same escaping as lib/siteflow/html.ts (kept local: factory modules do not import from siteflow). */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Change cell with the dashboard's semantics: for most metrics a rise is good,
 * but average position carries lowerIsBetter (8 → 5 improved), which flips the
 * good/bad tone. Unavailable metrics say "No data"; a null changePct (prior
 * period was 0) reads "New vs prior" instead of an invented percentage.
 */
function changeCell(metric: WebsiteDataMetric): string {
  if (!metric.available || metric.value == null) return `<span class="muted">No data</span>`;
  if (metric.changePct == null) return `<span class="muted">New vs prior</span>`;
  const rounded = Math.round(metric.changePct);
  if (rounded === 0) return `<span class="muted">0% vs prior</span>`;
  const improved = metric.lowerIsBetter ? rounded < 0 : rounded > 0;
  const sign = rounded > 0 ? "+" : "";
  return `<span class="${improved ? "ok" : "bad"}">${sign}${rounded}% vs prior</span>`;
}

function kpiRow(label: string, sub: string, valueHtml: string, metric: WebsiteDataMetric | null): string {
  return `<tr><td><strong>${esc(label)}</strong>${sub ? `<br><span class="muted">${esc(sub)}</span>` : ""}</td><td class="num">${valueHtml}</td><td>${metric ? changeCell(metric) : "—"}</td></tr>`;
}

function rankedSection(title: string, note: string, valueHeader: string, rows: WebsiteDataRanked[]): string {
  const body = rows.length
    ? `<table><thead><tr><th>${esc(title)}</th><th class="num">${esc(valueHeader)}</th><th class="num">Share</th></tr></thead><tbody>${rows
        .map(
          (row) =>
            `<tr><td>${esc(row.label)}</td><td class="num">${formatCount(row.value)}</td><td class="num">${Math.round(row.share * 100)}%</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="muted">No data for this period.</p>`;
  return `<h2>${esc(title)}</h2>${note ? `<p class="muted">${esc(note)}</p>` : ""}${body}`;
}

function sourcesNotice(report: WebsiteDataReport): string {
  const lines: string[] = [];
  if (report.sources.ga4 !== "ok") {
    lines.push(
      `Google Analytics is ${report.sources.ga4 === "not_connected" ? "not connected yet" : "unavailable for this pull"}${
        report.sources.ga4Message ? ` (${report.sources.ga4Message})` : ""
      }, so visitor and action figures are missing rather than estimated.`
    );
  }
  if (report.sources.gsc !== "ok") {
    lines.push(
      `Google Search Console is ${report.sources.gsc === "not_connected" ? "not connected yet" : "unavailable for this pull"}${
        report.sources.gscMessage ? ` (${report.sources.gscMessage})` : ""
      }, so search figures are missing rather than estimated.`
    );
  }
  if (!lines.length) return "";
  return `<div class="notice">${lines.map((line) => `<p>${esc(line)}</p>`).join("")}</div>`;
}

export function renderClientReport(
  report: WebsiteDataReport,
  opts: { preparedAt?: Date } = {}
): string {
  const prepared = opts.preparedAt ?? (report.fetchedAt ? new Date(report.fetchedAt) : new Date());
  const preparedLabel = prepared.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const domain = (report.site.gscSiteUrl || report.site.name)
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  const m = report.metrics;

  const kpiRows: string[] = [];
  // Key actions first, matching the dashboard. Untracked is stated plainly —
  // never rendered as 0 or a made-up number.
  if (m.conversions.tracked) {
    kpiRows.push(
      kpiRow(
        "Key actions",
        "Calls, forms & bookings marked as key events in GA4",
        formatCount(m.conversions.value),
        m.conversions
      )
    );
  } else {
    kpiRows.push(
      `<tr><td><strong>Key actions</strong><br><span class="muted">Calls, forms &amp; bookings marked as key events in GA4</span></td><td colspan="2">Not tracked — key events aren't marked in GA4 yet</td></tr>`
    );
  }
  kpiRows.push(kpiRow("Visitors", "Google Analytics", formatCount(m.visitors.value), m.visitors));
  kpiRows.push(kpiRow("Page views", "Google Analytics", formatCount(m.pageViews.value), m.pageViews));
  kpiRows.push(kpiRow("Search impressions", "Google Search Console", formatCount(m.impressions.value), m.impressions));
  kpiRows.push(kpiRow("Search clicks", "Google Search Console", formatCount(m.clicks.value), m.clicks));
  kpiRows.push(kpiRow("Click-through rate", "Share of impressions that earned a click", m.ctr.available ? formatRatePct(m.ctr.value) : "—", m.ctr));
  kpiRows.push(
    kpiRow(
      "Avg. position",
      "Average Google rank — lower is better",
      m.position.available && m.position.value != null ? m.position.value.toFixed(1) : "—",
      m.position
    )
  );
  if (m.revenue.tracked) {
    kpiRows.push(kpiRow("Revenue", "Purchase revenue tracked in GA4", formatMoney(m.revenue.value), m.revenue));
  } else {
    kpiRows.push(
      `<tr><td><strong>Revenue</strong><br><span class="muted">Purchase revenue tracked in GA4</span></td><td colspan="2">Not tracked</td></tr>`
    );
  }
  // Sitesinc only: real money collected through SiteFlow/Stripe, kept as its
  // own row — never added into the GA4 revenue figure above.
  if (report.site.kind === "sitesinc" && report.collectedRevenue) {
    kpiRows.push(
      `<tr><td><strong>Collected via Stripe (SiteFlow)</strong><br><span class="muted">Actual payments collected ${esc(
        report.collectedRevenue.start
      )} → ${esc(report.collectedRevenue.end)}, separate from GA4-tracked revenue above</span></td><td class="num">${formatMoney(
        report.collectedRevenue.amount
      )} (prior period ${formatMoney(report.collectedRevenue.priorAmount)})</td><td>—</td></tr>`
    );
  }

  const querySection = `<h2>Top search queries</h2>${
    report.queryRows.length
      ? `<table><thead><tr><th>Query</th><th class="num">Clicks</th><th class="num">Impressions</th><th class="num">CTR</th><th class="num">Position</th></tr></thead><tbody>${report.queryRows
          .map(
            (row) =>
              `<tr><td>${esc(row.label)}</td><td class="num">${formatCount(row.clicks)}</td><td class="num">${formatCount(
                row.impressions
              )}</td><td class="num">${formatRatePct(row.ctr)}</td><td class="num">${row.position > 0 ? row.position.toFixed(1) : "—"}</td></tr>`
          )
          .join("")}</tbody></table>`
      : `<p class="muted">No data for this period.</p>`
  }`;

  // The key-actions breakdown only exists when key events are tracked at all;
  // when untracked the KPI row already says so, so the section is omitted.
  const actionsSection = m.conversions.tracked
    ? rankedSection("Key actions breakdown", "Which tracked actions visitors took.", "Actions", report.topEvents)
    : "";

  const body = `<h1>${esc(report.site.name)} — website report</h1>
<p class="muted">${esc(domain)} · ${esc(report.period.start)} → ${esc(report.period.end)} (${esc(report.period.label)})<br>
Prepared by SitesInc · ${esc(preparedLabel)}</p>
${sourcesNotice(report)}
<h2>Summary</h2>
<table><thead><tr><th>Measure</th><th class="num">This period</th><th>Vs prior period (${esc(report.period.priorStart)} → ${esc(report.period.priorEnd)})</th></tr></thead>
<tbody>${kpiRows.join("")}</tbody></table>
${rankedSection("Top pages", "Most-viewed pages on the site.", "Views", report.topPages)}
${querySection}
${actionsSection}
${rankedSection("Where visitors come from", "Traffic channels, by visitors.", "Visitors", report.topChannels)}
${rankedSection("Top cities", "Towns your visitors are in.", "Visitors", report.topCities)}
<h2>About this report</h2>
<p class="muted">Figures in this report come from this site's Google Analytics and Google Search Console for the period shown (${esc(
    report.period.start
  )} → ${esc(report.period.end)}), compared with the prior period. They are the numbers those tools recorded — nothing is estimated or rounded up. Prepared by SitesInc (sitesinc.co).</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(`${report.site.name} website report — ${report.period.label}`)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:880px;margin:2rem auto;padding:0 1rem;color:#111;line-height:1.5;background:#fff}
h1{font-size:1.6rem;margin-bottom:.25rem}h2{font-size:1.2rem;margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{border:1px solid #ddd;padding:.4rem .5rem;text-align:left;vertical-align:top}
th{background:#f5f5f5}td.num,th.num{text-align:right}.muted{color:#666;font-size:.85rem}.ok{color:#0a7a2f}.bad{color:#b42318}
.notice{border:1px solid #e3c878;background:#fdf6dd;border-radius:8px;padding:.5rem .9rem;margin:1rem 0}.notice p{margin:.3rem 0;font-size:.9rem}
@media print{body{margin:0;max-width:none}}
</style></head><body>${body}
</body></html>`;
}
