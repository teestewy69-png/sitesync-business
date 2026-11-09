"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import content from "@/content.json";
import {
  formatRatePct,
  sparklinePath,
  type WebsiteDataMetric,
  type WebsiteDataPreset,
  type WebsiteDataQueryRow,
  type WebsiteDataRanked,
  type WebsiteDataReport,
  type WebsiteDataSiteOption,
} from "@/lib/factory/website-data-model";
import styles from "@/app/app/website-data/website-data.module.css";

const PRESETS: Array<{ id: Exclude<WebsiteDataPreset, "custom">; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
];

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/website-data", label: "Website data" },
  { href: "/app/seo", label: "SEO" },
];

function formatCount(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function changeText(metric: WebsiteDataMetric): { text: string; tone: "up" | "dn" | "flat" } {
  if (!metric.available) return { text: "No data", tone: "flat" };
  if (metric.changePct == null) return { text: "New vs prior", tone: "flat" };
  const rounded = Math.round(metric.changePct);
  const sign = rounded > 0 ? "+" : "";
  // Position is the one lowerIsBetter metric: a negative changePct means the
  // rank improved (8 → 5), so the good/bad coloring flips for it alone.
  const improved = metric.lowerIsBetter ? rounded < 0 : rounded > 0;
  const worsened = metric.lowerIsBetter ? rounded > 0 : rounded < 0;
  return {
    text: `${sign}${rounded}% vs prior`,
    tone: improved ? "up" : worsened ? "dn" : "flat",
  };
}

function Kpi({
  label,
  metric,
  money,
  percent,
  decimals,
  tracked,
  wide,
  sub,
  foot,
}: {
  label: string;
  metric: WebsiteDataMetric;
  money?: boolean;
  /** Value is a rate stored as a fraction; display as a percentage (CTR). */
  percent?: boolean;
  /** Display the raw value with this many decimal places (average position). */
  decimals?: number;
  tracked?: boolean;
  wide?: boolean;
  sub?: string;
  foot?: string;
}) {
  const delta = changeText(metric);
  const display =
    !metric.available && tracked === false
      ? "Not tracked"
      : percent
        ? formatRatePct(metric.value)
        : decimals != null
          ? metric.value == null
            ? "—"
            : metric.value.toFixed(decimals)
          : money
            ? formatMoney(metric.value)
            : formatCount(metric.value);
  return (
    <div className={`${styles.kpi} ${wide ? styles.rev : ""}`}>
      <div className={styles.lbl}>{label}</div>
      <div className={styles.valueNum}>{display}</div>
      <div className={`${styles.delta} ${delta.tone === "dn" ? styles.dn : delta.tone === "flat" ? styles.flat : ""}`}>{delta.text}</div>
      {sub ? <div className={styles.note}>{sub}</div> : null}
      {foot ? <div className={styles.note}>{foot}</div> : null}
    </div>
  );
}

function RankTable({ rows, empty }: { rows: WebsiteDataRanked[]; empty: string }) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  return (
    <table className={styles.table}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>
              {row.label}
              <div className={styles.bar}>
                <i style={{ width: `${Math.max(4, Math.round(row.share * 100))}%` }} />
              </div>
            </td>
            <td>{`${Math.round(row.share * 100)}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QueryTable({ rows, empty }: { rows: WebsiteDataQueryRow[]; empty: string }) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  return (
    <table className={styles.table}>
      <tbody>
        <tr>
          <td className={styles.note}>Query</td>
          <td className={styles.note}>Clicks</td>
          <td className={styles.note}>Impr.</td>
          <td className={styles.note}>CTR</td>
          <td className={styles.note}>Pos.</td>
        </tr>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>
              {row.label}
              <div className={styles.bar}>
                <i style={{ width: `${Math.max(4, Math.round(row.share * 100))}%` }} />
              </div>
            </td>
            <td>{formatCount(row.clicks)}</td>
            <td>{formatCount(row.impressions)}</td>
            <td>{formatRatePct(row.ctr)}</td>
            <td>{row.position > 0 ? row.position.toFixed(1) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function WebsiteDataDashboard({
  initial,
  sites,
}: {
  initial: WebsiteDataReport;
  sites: WebsiteDataSiteOption[];
}) {
  const [report, setReport] = useState(initial);
  const [siteId, setSiteId] = useState(initial.site.id);
  const [from, setFrom] = useState(initial.period.start);
  const [to, setTo] = useState(initial.period.end);
  const [tab, setTab] = useState<"pages" | "queries" | "actions">("pages");
  const [sourceTab, setSourceTab] = useState<"channels" | "cities">("channels");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const spark = useMemo(
    () => sparklinePath(report.dailyVisitors.map((row) => row.users)),
    [report.dailyVisitors]
  );

  async function load(next: { site?: string; preset?: string; from?: string; to?: string }) {
    setBusy(true);
    setError("");
    const params = new URLSearchParams();
    if (next.site) params.set("site", next.site);
    if (next.preset) params.set("preset", next.preset);
    if (next.from && next.to) {
      params.set("from", next.from);
      params.set("to", next.to);
    }
    try {
      const res = await fetch(`/api/factory/website-data?${params.toString()}`);
      const data = (await res.json()) as { ok?: boolean; error?: string; report?: WebsiteDataReport };
      if (!res.ok || !data.report) {
        setError(data.error || "Could not load website data.");
        return;
      }
      setReport(data.report);
      setFrom(data.report.period.start);
      setTo(data.report.period.end);
      setSiteId(data.report.site.id);
    } catch {
      setError("Could not load website data.");
    } finally {
      setBusy(false);
    }
  }

  const banners = [
    report.sources.missing.length
      ? `Not connected. Missing ${report.sources.missing.join(", ")}. Numbers are not estimated.`
      : "",
    report.sources.ga4 === "error" ? report.sources.ga4Message : "",
    report.sources.gsc === "error" ? report.sources.gscMessage : "",
    report.site.kind === "client" && !report.live && !report.sources.missing.length
      ? "Client properties are used only when that client has its own GA4 / Search Console ids."
      : "",
    report.site.kind === "unknown" ? report.sources.ga4Message : "",
  ].filter((text): text is string => Boolean(text));

  return (
    <div className={styles.page} data-website-data>
      <header className={styles.header}>
        <button className={styles.burger} type="button" aria-label="Menu" onClick={() => setMenu((open) => !open)}>
          ☰
        </button>
        <Link href="/app" className={styles.logo}>
          <span className={styles.mark}>S</span>
          <span>
            Sites<span className={styles.logoGold}>inc</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label="Factory">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={item.href === "/app/website-data" ? styles.on : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {menu ? (
        <div className={styles.mobileNav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={item.href === "/app/website-data" ? styles.on : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <main className={styles.main}>
        <div className={styles.title}>
          <h1>Website data</h1>
        </div>
        <p className={styles.sub}>Key actions, visitors, impressions, clicks and revenue for the period you pick.</p>

        {sites.length > 1 ? (
          <label className={styles.sitePick}>
            Property
            <select
              value={siteId}
              onChange={(event) => {
                const next = event.target.value;
                setSiteId(next);
                void load({ site: next, from, to });
              }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {banners.map((text) => (
          <p key={text} className={`${styles.banner} ${text.toLowerCase().includes("returned") || text.toLowerCase().includes("failed") ? styles.err : styles.warn}`}>
            {text}
          </p>
        ))}
        {error ? <p className={`${styles.banner} ${styles.err}`}>{error}</p> : null}

        <div className={styles.grid}>
          <div>
            <section className={styles.card}>
              <div className={styles.presets}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={report.period.preset === preset.id ? styles.on : undefined}
                    disabled={busy}
                    onClick={() => void load({ site: siteId, preset: preset.id })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className={styles.range}>
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                <span style={{ color: "var(--wd-mu)" }}>→</span>
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
              <button className={styles.apply} type="button" disabled={busy} onClick={() => void load({ site: siteId, from, to })}>
                {busy ? "Loading…" : "Apply"}
              </button>
              {report.live ? (
                <a
                  className={styles.apply}
                  style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                  href={`/api/factory/website-data/report?site=${encodeURIComponent(siteId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                  download
                >
                  Download client report
                </a>
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.lbl}>Overview</div>
              <div className={styles.per}>{report.period.label}</div>
              <div className={styles.kpis}>
                <Kpi
                  label="Key actions"
                  metric={report.metrics.conversions}
                  tracked={report.metrics.conversions.tracked}
                  sub="Calls, forms & bookings marked as key events in GA4"
                />
                <Kpi label="Visitors" metric={report.metrics.visitors} />
                <Kpi label="Page views" metric={report.metrics.pageViews} />
                <Kpi label="Impressions" metric={report.metrics.impressions} />
                <Kpi label="Clicks" metric={report.metrics.clicks} />
                <Kpi label="CTR" metric={report.metrics.ctr} percent sub="Share of impressions that earned a click" />
                <Kpi label="Avg. position" metric={report.metrics.position} decimals={1} sub="Average Google rank — lower is better" />
                <Kpi
                  label="Revenue"
                  metric={report.metrics.revenue}
                  money
                  tracked={report.metrics.revenue.tracked}
                  wide
                  foot={
                    report.site.kind === "sitesinc" && report.collectedRevenue
                      ? `Collected via Stripe (SiteFlow), ${report.collectedRevenue.start} → ${report.collectedRevenue.end}: ${formatMoney(report.collectedRevenue.amount)} · prior period ${formatMoney(report.collectedRevenue.priorAmount)}`
                      : undefined
                  }
                />
              </div>
              {spark.line ? (
                <svg className={styles.spark} viewBox="0 0 300 90" preserveAspectRatio="none" aria-label="Daily visitors">
                  <defs>
                    <linearGradient id="wd-spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#d4af37" stopOpacity="0.45" />
                      <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={spark.area} fill="url(#wd-spark)" />
                  <path d={spark.line} fill="none" stroke="#f3d77a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              ) : (
                <p className={styles.empty}>No daily visitor trend for this period.</p>
              )}
              <div className={styles.note}>Daily visitors · GA4 totalUsers</div>
            </section>
          </div>

          <div className={styles.side}>
            <section className={`${styles.card} ${styles.value}`}>
              <div className={styles.lbl}>◆ Estimated value</div>
              <div className={styles.note}>All-time estimate. The period does not change it.</div>
              <div className={styles.big}>
                {report.estimatedValue.status === "ok" ? formatMoney(report.estimatedValue.amount) : "—"}
              </div>
              <div className={styles.note}>{report.estimatedValue.note}</div>
              <div className={styles.note}>{report.estimatedValue.formula}</div>
            </section>

            <section className={styles.card}>
              <div className={styles.lbl}>Top performers</div>
              <div className={styles.tabs}>
                <button type="button" className={tab === "pages" ? styles.on : undefined} onClick={() => setTab("pages")}>
                  Pages
                </button>
                <button type="button" className={tab === "queries" ? styles.on : undefined} onClick={() => setTab("queries")}>
                  Search queries
                </button>
                <button type="button" className={tab === "actions" ? styles.on : undefined} onClick={() => setTab("actions")}>
                  Key actions
                </button>
              </div>
              {tab === "pages" ? (
                <RankTable rows={report.topPages} empty="No page rows returned for this period." />
              ) : tab === "queries" ? (
                <QueryTable rows={report.queryRows} empty="No search queries returned for this period." />
              ) : (
                <RankTable rows={report.topEvents} empty="No key events returned for this period." />
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.lbl}>Sources</div>
              <div className={styles.note}>Where visitors come from — and which towns they are in.</div>
              <div className={styles.tabs}>
                <button type="button" className={sourceTab === "channels" ? styles.on : undefined} onClick={() => setSourceTab("channels")}>
                  Channels
                </button>
                <button type="button" className={sourceTab === "cities" ? styles.on : undefined} onClick={() => setSourceTab("cities")}>
                  Top cities
                </button>
              </div>
              {sourceTab === "channels" ? (
                <RankTable rows={report.topChannels} empty="No channel rows returned for this period." />
              ) : (
                <>
                  <div className={styles.note}>Towns your visitors are in</div>
                  <RankTable rows={report.topCities} empty="No city rows returned for this period." />
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <a href="https://sitesinc.co">sitesinc.co</a>
        {" · "}
        <a href={content.footer.phoneHref}>{content.footer.phone}</a>
        {" · "}
        <a href={`mailto:${content.footer.email}`}>{content.footer.email}</a>
      </footer>
    </div>
  );
}
