import Link from "next/link";
import SeoWorkspace, { siteFromSearchParams } from "@/components/factory/SeoWorkspace";

export const dynamic = "force-dynamic";

export default async function SeoRefreshPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const siteId = await siteFromSearchParams(searchParams);
  return (
    <SeoWorkspace siteId={siteId}>
      {(model) => (
        <div>
          <h2 className="text-lg font-semibold">Content refresh</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Opportunities from thin or incomplete baseline pages, content-brief gaps, and factory
            pages that are not live. Opens the existing briefs/staging tools — this is not a separate
            writer.
          </p>
          {model.refresh.length ? (
            <ul className="mt-4 space-y-2">
              {model.refresh.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm">
                  <p className="font-medium text-white">
                    {item.briefTitle || item.path}{" "}
                    <span className="text-slate-500">{item.path}</span>
                  </p>
                  <p className="mt-1 text-slate-400">{item.reason}</p>
                  <Link href={item.href} className="mt-2 inline-block text-brand-300">
                    Open related tool
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No refresh opportunities from the current baseline and briefs.</p>
          )}
        </div>
      )}
    </SeoWorkspace>
  );
}
