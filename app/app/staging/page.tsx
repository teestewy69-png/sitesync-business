import Link from "next/link";
import ActionForm from "@/components/factory/ActionForm";
import ProductionReleaseForm from "@/components/factory/ProductionReleaseForm";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { readWorkspace } from "@/lib/factory/workspace";

export default async function StagingIndex() {
  const workspace = await readWorkspace();
  return (
    <FactoryShell title="Staging build">
      <p className="text-base text-slate-300">
        Every staging URL is noindex. Production homepage is not replaced from here.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionForm op="stage-pages" label="Move approved pages to staging" fields={{ approvedBy: "operator" }} />
        <ActionForm op="rollback" label="Rollback factory pages" tone="danger" fields={{ approvedBy: "operator" }} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Approve production separately</h2>
      <p className="mt-2 text-sm text-slate-400">
        Staging can pass without going live. Choose surfaces only after QA. Publishing routes still
        does not deploy sitesinc.co — that is a later Netlify production step.
      </p>
      <ProductionReleaseForm selected={workspace.productionRelease?.selected || []} />
      {workspace.productionRelease?.selected?.length ? (
        <div className="mt-3">
          <ActionForm
            op="publish-pages"
            label="Publish selected surfaces to repo routes"
            fields={{ approvedBy: "operator" }}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-100">
          No production surfaces selected. Factory pages stay staged and noindex.
        </p>
      )}
      <ul className="mt-6 space-y-2">
        {workspace.pages.map((page) => (
          <li key={page.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3">
            <div>
              <p className="font-medium">{page.title}</p>
              <p className="text-sm text-slate-400">{page.path}</p>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={page.noindex ? "warn" : "ok"}>{page.noindex ? "noindex" : "indexable"}</Pill>
              <Pill>{page.status}</Pill>
              <Link href={`/app/staging/${page.slug}`} className="text-sm text-brand-300">
                Preview
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </FactoryShell>
  );
}
