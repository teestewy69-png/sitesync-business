import type { Metadata } from "next";
import WebsiteDataDashboard from "@/components/factory/WebsiteDataDashboard";
import { listWebsiteDataSites, loadWebsiteData } from "@/lib/factory/website-data";
import { resolvePeriod, utcYmd } from "@/lib/factory/website-data-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website data",
};

export default async function WebsiteDataPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; preset?: string; from?: string; to?: string }>;
}) {
  const params = (await Promise.resolve(searchParams || {})) as {
    site?: string;
    preset?: string;
    from?: string;
    to?: string;
  };
  const [report, sites] = await Promise.all([
    loadWebsiteData({
      siteId: params.site,
      preset: params.preset,
      from: params.from,
      to: params.to,
    }),
    listWebsiteDataSites(),
  ]);

  if ("error" in report) {
    const fallbackPeriod = resolvePeriod({ today: utcYmd(new Date()) });
    const empty = {
      site: sites[0],
      period: fallbackPeriod.ok
        ? fallbackPeriod
        : {
            preset: "30d" as const,
            start: utcYmd(new Date()),
            end: utcYmd(new Date()),
            priorStart: utcYmd(new Date()),
            priorEnd: utcYmd(new Date()),
            label: "Last 30 days",
            days: 30,
          },
      sources: {
        ga4: "error" as const,
        gsc: "error" as const,
        ga4Message: report.error,
        gscMessage: report.error,
        missing: [],
      },
      metrics: {
        conversions: { value: null, changePct: null, available: false, source: "ga4" as const, tracked: false },
        visitors: { value: null, changePct: null, available: false, source: "ga4" as const },
        pageViews: { value: null, changePct: null, available: false, source: "ga4" as const },
        impressions: { value: null, changePct: null, available: false, source: "gsc" as const },
        clicks: { value: null, changePct: null, available: false, source: "gsc" as const },
        ctr: { value: null, changePct: null, available: false, source: "gsc" as const },
        position: { value: null, changePct: null, available: false, source: "gsc" as const, lowerIsBetter: true },
        revenue: { value: null, changePct: null, available: false, source: "ga4" as const, tracked: false },
      },
      dailyVisitors: [],
      topPages: [],
      topQueries: [],
      queryRows: [],
      topEvents: [],
      topChannels: [],
      topCities: [],
      collectedRevenue: null,
      estimatedValue: {
        status: "placeholder" as const,
        amount: null,
        formula: "",
        note: report.error,
      },
      fetchedAt: new Date().toISOString(),
      live: false,
    };
    return <WebsiteDataDashboard initial={empty} sites={sites} />;
  }

  return <WebsiteDataDashboard initial={report} sites={sites} />;
}
