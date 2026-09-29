import SeoOpsTools from "@/components/factory/SeoOpsTools";
import SeoWorkspace, { siteFromSearchParams } from "@/components/factory/SeoWorkspace";
import { readWorkspace } from "@/lib/factory/workspace";

export const dynamic = "force-dynamic";

export default async function SeoOpsPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const siteId = await siteFromSearchParams(searchParams);
  const workspace = await readWorkspace();
  return (
    <SeoWorkspace siteId={siteId}>
      {(model) => <SeoOpsTools workspace={workspace} preflight={model.preflight} />}
    </SeoWorkspace>
  );
}
