import FactoryShell, { Pill } from "@/components/factory/Shell";
import CaptureButton from "@/components/factory/CaptureButton";
import ScreenshotUpload from "@/components/factory/ScreenshotUpload";
import { PRODUCTION_ORIGIN } from "@/lib/factory/pipeline";
import { latestBaseline, readWorkspace } from "@/lib/factory/workspace";

export default async function BaselinePage() {
  const baseline = await latestBaseline();
  const workspace = await readWorkspace();
  return (
    <FactoryShell title="Day 0 baseline">
      <p className="text-base text-slate-300">
        Dated crawl of live production. Secrets are not stored. Analytics numbers are not invented if Search Console / GA are missing.
      </p>
      <div className="mt-4">
        <CaptureButton origin={PRODUCTION_ORIGIN} />
      </div>
      <h2 className="mt-8 text-lg font-semibold">Screenshot references</h2>
      <p className="mt-1 text-sm text-slate-400">Desktop or mobile captures of public pages only. No admin or client data.</p>
      <ScreenshotUpload />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {workspace.screenshots.map((shot) => (
          <figure key={shot.id} className="overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.url} alt={shot.label} className="h-32 w-full object-cover" />
            <figcaption className="px-3 py-2 text-xs text-slate-400">
              {shot.viewport} · {shot.label}
            </figcaption>
          </figure>
        ))}
      </div>
      {!baseline ? (
        <p className="mt-6 text-amber-200">No baseline yet. Capture before any factory publish.</p>
      ) : (
        <div className="mt-8 space-y-8">
          <p className="text-sm text-slate-400">
            {baseline.id} · {baseline.capturedAt} · {baseline.origin} · source {baseline.source}
          </p>
          <section>
            <h2 className="text-lg font-semibold">Page inventory</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Words</th>
                    <th className="px-3 py-2">H1</th>
                    <th className="px-3 py-2">Schema</th>
                    <th className="px-3 py-2">Canonical</th>
                  </tr>
                </thead>
                <tbody>
                  {baseline.pageInventory.map((page) => (
                    <tr key={page.path} className="border-t border-white/10">
                      <td className="px-3 py-2 text-brand-300">{page.path}</td>
                      <td className="px-3 py-2">{page.title || "—"}</td>
                      <td className="px-3 py-2">{page.wordCount}</td>
                      <td className="px-3 py-2">{page.headings.h1[0] || "—"}</td>
                      <td className="px-3 py-2">{page.schemaTypes.join(", ") || "none"}</td>
                      <td className="px-3 py-2">{page.canonical ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">Robots / sitemap</h3>
              <p className="mt-2 text-sm text-slate-300">
                robots.txt {baseline.robotsTxt.ok ? "ok" : baseline.robotsTxt.error} · sitemap{" "}
                {baseline.sitemap.ok ? `${baseline.sitemap.urls.length} URLs` : baseline.sitemap.error}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">Indexing / analytics</h3>
              <p className="mt-2 text-sm text-slate-300">{baseline.indexing.note}</p>
              <p className="mt-2 text-sm text-slate-300">{baseline.analytics.note}</p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">Broken links</h3>
              {baseline.brokenLinks.length ? (
                <ul className="mt-2 space-y-1 text-sm text-amber-100">
                  {baseline.brokenLinks.map((link) => (
                    <li key={`${link.from}-${link.href}`}>
                      {link.from} → {link.href} ({link.error || link.status})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-400">None found in the sampled internal set.</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">Intake health</h3>
              <p className="mt-2 text-sm">
                <Pill tone={baseline.intakeFormHealth.launchBlocking ? "warn" : "ok"}>
                  {baseline.intakeFormHealth.launchBlocking ? "launch blocking" : "forms responding"}
                </Pill>
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {baseline.intakeFormHealth.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </FactoryShell>
  );
}
