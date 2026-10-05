import Link from "next/link";
import { notFound } from "next/navigation";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { configFromProject } from "@/lib/factory/client-config";
import { getClientTemplate } from "@/lib/factory/client-templates";
import { readClientWorkspace } from "@/lib/factory/client-workspace";
import { DESIGN_STYLES } from "@/lib/design-styles";
import { findProjectById } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  if (!project) notFound();

  const config = configFromProject(project);
  const template = getClientTemplate(project.templateId || config.templateId);
  const style =
    DESIGN_STYLES.find((item) => item.id === (project.designStyleId || config.designStyleId)) ||
    DESIGN_STYLES[0];
  const workspace = await readClientWorkspace(projectId);
  const pages = project.seededPages?.length ? project.seededPages : config.seededPages;

  return (
    <FactoryShell title={`Client project · ${config.businessName}`}>
      <p className="max-w-3xl text-sm text-slate-400">
        Structured client config bound to template + design. Client factory workspace is separate from the
        Sitesinc growth case study (<code className="text-slate-300">sitesinc-growth-case-study</code>).
        Preview is honest: no auto-publish to Netlify.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Pill tone="ok">template {template.id}</Pill>
        <Pill>design {style.id}</Pill>
        <Pill tone={workspace ? "ok" : "warn"}>
          workspace {workspace ? "initialized" : "missing"}
        </Pill>
        <Link
          href={`/demo/client/${projectId}`}
          className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-400/10"
        >
          Open deliverable preview
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Client config</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {[
          ["Business", config.businessName],
          ["Email", config.email || project.email || "—"],
          ["Niche", config.niche],
          ["Type", config.businessType],
          ["City", config.city || "—"],
          ["State", config.state || "—"],
          ["Phone", config.phone || "—"],
          ["Primary goal", config.primaryGoal || "—"],
          ["Monitoring interest", project.monitoringInterest ? "yes" : "no"],
          ["CRM id", project.id],
          ["Factory workspace id", project.factoryWorkspaceId || project.id],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-1 text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
      {config.notes ? (
        <p className="mt-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
          Notes: {config.notes}
        </p>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold">Seeded pages</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {pages.map((page) => {
          const row = workspace?.pages.find((item) => item.slug === page.slug);
          return (
            <li
              key={page.slug}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">{page.title}</p>
                <p className="text-slate-400">
                  {page.path} — {page.purpose}
                </p>
                {page.targetKeywords?.length ? (
                  <p className="text-xs text-slate-500">keywords: {page.targetKeywords.join(", ")}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Pill>{row?.status || "planned"}</Pill>
                <Link
                  href={
                    page.slug === "home"
                      ? `/demo/client/${projectId}`
                      : `/demo/client/${projectId}/${page.slug}`
                  }
                  className="text-brand-300"
                >
                  Preview
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Client factory stages</h2>
      {workspace ? (
        <ul className="mt-3 space-y-2 text-sm">
          {workspace.stages.map((stage) => (
            <li
              key={stage.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3"
            >
              <span>
                {stage.order}. {stage.name}
                {stage.notes ? (
                  <span className="mt-1 block max-w-2xl text-xs text-slate-500">{stage.notes}</span>
                ) : null}
              </span>
              <Pill
                tone={
                  stage.status === "complete" || stage.status === "approved"
                    ? "ok"
                    : stage.status === "in_progress" || stage.status === "ready_for_review"
                      ? "warn"
                      : "muted"
                }
              >
                {stage.status}
              </Pill>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-amber-100">
          No client workspace document yet. Run factory action{" "}
          <code>init-client-factory</code> with this projectId, or re-submit intake.
        </p>
      )}

      {workspace?.briefs?.length ? (
        <>
          <h2 className="mt-8 text-lg font-semibold">Briefs (analyze top 3 = competitorUrls)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.briefs.map((brief) => (
              <li key={brief.id} className="rounded-xl border border-white/10 px-4 py-3">
                <strong>{brief.title}</strong> · {brief.status}
                <span className="mt-1 block text-slate-400">
                  competitorUrls:{" "}
                  {brief.competitorUrls.length
                    ? brief.competitorUrls.join(", ")
                    : "none — attach via set-brief-competitors"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="mt-8 text-xs text-slate-500">
        Wired: structured CRM fields, template page seed, design id, per-client workspace, preview route.
        Still manual: real competitor research, final copy polish, photos, Netlify client deploy.
      </p>
    </FactoryShell>
  );
}
