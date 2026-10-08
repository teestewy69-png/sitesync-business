import { Suspense, type ReactNode } from "react";
import FactoryShell from "@/components/factory/Shell";
import SeoChrome from "@/components/factory/SeoChrome";
import { loadSeoModel, type SeoModel } from "@/lib/factory/seo-intelligence";

export async function siteFromSearchParams(
  searchParams?: Promise<{ site?: string }> | { site?: string }
) {
  const params = await Promise.resolve(searchParams || {});
  return typeof params.site === "string" ? params.site : undefined;
}

export default async function SeoWorkspace({
  siteId,
  children,
}: {
  siteId?: string;
  children: (model: SeoModel) => ReactNode;
}) {
  const model = await loadSeoModel(siteId);
  return (
    <FactoryShell title="SEO Intelligence">
      <Suspense fallback={<p className="mb-8 text-sm text-slate-500">Loading site selector…</p>}>
        <SeoChrome sites={model.sites} selectedId={model.site.id} />
      </Suspense>
      {children(model)}
    </FactoryShell>
  );
}
