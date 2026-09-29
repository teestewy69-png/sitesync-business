import Link from "next/link";
import CaptureButton from "@/components/factory/CaptureButton";
import { Pill } from "@/components/factory/Shell";
import SeoWorkspace, { siteFromSearchParams } from "@/components/factory/SeoWorkspace";
import { PRODUCTION_ORIGIN } from "@/lib/factory/pipeline";

export const dynamic = "force-dynamic";

export default async function SeoOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const siteId = await siteFromSearchParams(searchParams);
  return (
    <SeoWorkspace siteId={siteId}>
      {(model) => (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">Selected site</p>
              <p className="text-lg font-semibold">{model.site.name}</p>
              <p className="text-sm text-slate-400">{model.site.origin}</p>
            </div>
            <CaptureButton origin={model.site.origin || PRODUCTION_ORIGIN} />
          </div>

          {!model.gscConfigured ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Search Console is not connected. Indexing rows below are operator/sitemap signals only —
              nothing is marked indexed.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Pages inventoried" value={String(model.summary.inventoried)} note={model.baseline ? `Baseline ${model.baseline.capturedAt.slice(0, 19)}` : "No baseline yet"} />
            <Card
              label="Technical preflight"
              value={`${model.summary.preflightFails} fail · ${model.summary.preflightWarns} warn`}
              note="From the last crawl + staging rules"
            />
            <Card
              label="Indexing"
              value={model.gscConfigured ? `${model.summary.indexingIndexed} verified indexed` : "Not verified"}
              note={`${model.summary.indexingKnown} rows have a check or submission signal`}
            />
            <Card
              label="Backlinks documented"
              value={String(model.backlinkCount)}
              note={model.backlinkCount ? "Operator-recorded only" : "Empty on purpose"}
            />
          </div>

          <section className="rounded-2xl border border-white/10 p-5">
            <h2 className="text-lg font-semibold">Site architecture</h2>
            <p className="mt-1 text-sm text-slate-400">
              Hub list from the factory blueprint plus internal-link counts from the baseline. This is
              not a crawl-budget or rank map.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-300">
              <li>Live inventory: {model.summary.inventoried} URLs</li>
              <li>Planned factory pages not in crawl: {model.summary.plannedNotLive}</li>
              <li>
                Internal links:{" "}
                {model.baseline
                  ? `${model.baseline.internalLinkSummary.total} across ${model.baseline.internalLinkSummary.uniqueTargets} targets`
                  : "n/a"}
              </li>
              <li>
                Sitemap:{" "}
                {model.baseline?.sitemap.ok ? `${model.baseline.sitemap.urls.length} URLs` : model.baseline?.sitemap.error || "not captured"}
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 p-5">
            <h2 className="text-lg font-semibold">Major issues</h2>
            {model.issues.length ? (
              <ul className="mt-3 space-y-2">
                {model.issues.slice(0, 8).map((issue) => (
                  <li key={issue.id} className="text-sm">
                    <Pill tone={issue.severity === "fail" ? "warn" : "muted"}>{issue.type}</Pill>{" "}
                    <span className="text-slate-300">
                      {issue.path} — {issue.detail}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No implemented issue types fired on this baseline.</p>
            )}
            <Link
              href={`/app/seo/issues?site=${encodeURIComponent(model.site.id)}`}
              className="mt-3 inline-block text-sm text-brand-300"
            >
              Open diagnostics →
            </Link>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="text-lg font-semibold">Performance</h2>
              <p className="mt-2 text-sm text-slate-300">
                Avg TTFB {model.summary.avgTtfbMs ?? "—"} ms from the server crawl. Lighthouse:{" "}
                {model.summary.lighthouse.replace("_", " ")}.
              </p>
              <p className="mt-2 text-xs text-slate-500">Lab scores are not automated in this launch version.</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-5">
              <h2 className="text-lg font-semibold">Not in this workspace yet</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
                {model.absentCapabilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </SeoWorkspace>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}
