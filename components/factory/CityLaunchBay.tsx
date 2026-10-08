import Link from "next/link";
import type { CityLaunchBaySummary } from "@/lib/factory/city-launch";

export default function CityLaunchBay({ summary }: { summary: CityLaunchBaySummary }) {
  const { provider, totals, rows, dataset } = summary;
  return (
    <section className="mt-10 rounded-2xl border border-brand-400/30 bg-white/5 p-5" id="city-launch-bay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Factory bay</p>
          <h2 className="text-xl font-semibold">ScaleQuan · City Launch</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            ScaleQuan Content Studio, in this workshop. Up to 500 animated city landing pages per client per batch.
            Real cities ({dataset.count.toLocaleString()} U.S. places, Census {dataset.populationYear} population + Gazetteer
            coordinates), LLM-written per city, blocked by the uniqueness gate if near-duplicate, human-approved, then live
            on the client preview automatically. Real-domain publish = Tony&apos;s sign-off + manual production deploy.
          </p>
        </div>
        <div className="text-right text-xs">
          {provider.configured ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-200">
              LLM {provider.envKey} · {provider.model}
            </span>
          ) : (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-200">LLM key missing - writing disabled</span>
          )}
        </div>
      </div>
      {!provider.configured ? <p className="mt-3 text-sm text-red-100">{provider.detail}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {[
          ["Pages", totals.total],
          ["Writing / queued", totals.generating + totals.queued],
          ["Drafts to review", totals.draft],
          ["Approved (on preview)", totals.approved],
          ["Gate-blocked", totals.blocked],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 px-3 py-2">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <Link href={`/app/clients/${row.id}#city-launch`} className="font-medium text-white hover:text-brand-300">
                  {row.name}
                </Link>
                <span className="text-slate-500"> {row.city}</span>
              </span>
              <span className="text-xs text-slate-400">
                {row.counts.total ? `${row.counts.approved} approved · ${row.counts.draft} drafts · ${row.counts.blocked} blocked` : "no city pages yet"}
                {row.latestBatch ? ` · batch ${row.latestBatch.status} (${row.latestBatch.total})` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No client projects yet.</p>
      )}
    </section>
  );
}
