import { loadGaSummary } from "@/lib/factory/analytics-report";

/** Sessions / key events from the GA4 Data API, with an explicit "not connected" state. */
export default async function GaSummaryCard() {
  const summary = await loadGaSummary();
  return (
    <section className="rounded-2xl border border-white/10 p-5" id="ga-summary">
      <h2 className="text-lg font-semibold">Traffic and conversions (GA4)</h2>
      {summary.status === "not_connected" ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Not connected. No traffic numbers are shown or estimated.</p>
          <p className="mt-1">
            Missing in .env.local: <code>{summary.missing.join(", ")}</code>. The site itself already sends data to GA4;
            this card only reads it back through the GA4 Data API.
          </p>
        </div>
      ) : summary.status === "error" ? (
        <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Connected, but Google returned an error: {summary.message}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-400">
            Last {summary.days} days, property {summary.propertyId}, read {summary.fetchedAt.slice(0, 16).replace("T", " ")} UTC.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["Sessions", summary.sessions],
              ["Users", summary.users],
              ["Key events (conversions)", summary.keyEvents],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/10 px-3 py-2">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-2xl font-semibold text-white">{Number(value).toLocaleString()}</p>
              </div>
            ))}
          </div>
          {summary.topPages.length ? (
            <ul className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10 text-sm">
              {summary.topPages.map((row) => (
                <li key={row.path} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-slate-200">{row.path}</span>
                  <span className="text-slate-400">
                    {row.sessions.toLocaleString()} sessions · {row.keyEvents.toLocaleString()} key events
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No page rows returned for this period.</p>
          )}
        </>
      )}
    </section>
  );
}
