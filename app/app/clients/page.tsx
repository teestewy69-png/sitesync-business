import { headers } from "next/headers";
import Link from "next/link";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import LeadStageSelect from "@/components/factory/LeadStageSelect";
import { stageLabel, stageOf } from "@/lib/lead-stage";
import { ensureBlobsFromRequest, listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SiteGrowClientsPage() {
  ensureBlobsFromRequest({ headers: await headers() });
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  try {
    projects = await listProjects();
  } catch (err) {
    console.warn("SiteGrow clients list unavailable.", err instanceof Error ? err.name : "unknown");
  }

  return (
    <FactoryShell title="SiteGrow · client website factory">
      <p className="max-w-3xl text-sm text-slate-400">
        Every live intake that creates a project lands here. Open a client to run DomainIQ, ScaleQuan (City
        Launch), baseline crawl, and content. Previews stay on /demo/client/... until Tony publishes.
      </p>
      <ul className="mt-8 space-y-2">
        {projects.length === 0 ? (
          <li className="text-sm text-slate-500">No client projects yet.</li>
        ) : (
          projects.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.businessName || item.label}</p>
                  <p className="text-sm text-slate-400">
                    {item.id}
                    {item.leadId ? ` · lead ${item.leadId}` : ""}
                    {item.email ? ` · ${item.email}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone={stageOf(item) === "done" ? "ok" : stageOf(item) === "closed" ? "muted" : "warn"}>
                      {stageLabel(stageOf(item))}
                    </Pill>
                    <Pill>{item.templateId || "no template"}</Pill>
                    <Pill>{item.designStyleId || "no design"}</Pill>
                    <Pill tone={item.factoryWorkspaceId ? "ok" : "warn"}>
                      {item.factoryWorkspaceId ? "workspace" : "no workspace"}
                    </Pill>
                  </div>
                  <LeadStageSelect id={item.id} stage={stageOf(item)} who={item.businessName || item.label} />
                </div>
                <span className="flex flex-wrap gap-3 text-sm">
                  <Link href={`/app/clients/${item.id}`} className="text-brand-300 hover:underline">
                    Open factory
                  </Link>
                  <Link href={`/demo/client/${item.id}`} className="text-slate-400 hover:text-white">
                    Preview
                  </Link>
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </FactoryShell>
  );
}
