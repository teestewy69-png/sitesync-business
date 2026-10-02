import { Pill } from "@/components/factory/Shell";
import SeoWorkspace, { siteFromSearchParams } from "@/components/factory/SeoWorkspace";

export const dynamic = "force-dynamic";

export default async function SeoPagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const siteId = await siteFromSearchParams(searchParams);
  return (
    <SeoWorkspace siteId={siteId}>
      {(model) => (
        <div>
          <h2 className="text-lg font-semibold">Page-level SEO</h2>
          <p className="mt-1 text-sm text-slate-400">
            Titles, meta, word counts, and headings from the dated baseline. Planned factory pages
            that were not in the crawl are labeled.
          </p>
          {!model.pages.length ? (
            <p className="mt-4 text-sm text-slate-400">
              No pages inventoried yet. Capture a dated baseline from Overview.
            </p>
          ) : null}
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Meta</th>
                  <th className="px-3 py-2">Words</th>
                  <th className="px-3 py-2">H1</th>
                  <th className="px-3 py-2">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {model.pages.map((page) => (
                  <tr key={`${page.source}:${page.path}`} className="border-t border-white/10 align-top">
                    <td className="px-3 py-2 text-brand-300">
                      {page.path}
                      <span className="mt-1 block text-xs text-slate-500">{page.source}</span>
                    </td>
                    <td className="px-3 py-2">{page.title || "—"}</td>
                    <td className="max-w-xs px-3 py-2 text-slate-400">{page.metaDescription || "—"}</td>
                    <td className="px-3 py-2">{page.wordCount || "—"}</td>
                    <td className="px-3 py-2">
                      {page.h1[0] || "—"}
                      {page.h2.length ? (
                        <span className="mt-1 block text-xs text-slate-500">{page.h2.length} H2 · {page.h3Count} H3</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {page.warnings.length ? (
                        <div className="flex flex-wrap gap-1">
                          {page.warnings.map((warning) => (
                            <Pill key={warning} tone="warn">
                              {warning}
                            </Pill>
                          ))}
                        </div>
                      ) : (
                        <Pill tone="ok">clear</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SeoWorkspace>
  );
}
