import type { Metadata } from "next";
import Link from "next/link";
import { plannedPagePurpose } from "@/lib/factory/client-templates";
import { notFound } from "next/navigation";
import { DESIGN_STYLES, type DesignStyleId } from "@/lib/design-styles";
import { buildClientPreviewModel } from "@/lib/factory/client-preview";
import { configFromProject } from "@/lib/factory/client-config";
import { readClientWorkspace } from "@/lib/factory/client-workspace";
import { readCityIndex } from "@/lib/factory/city-launch";
import { approvedEntries } from "@/lib/factory/city-launch-public";
import { findProjectById } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  const name = project?.businessName || project?.label || "Client preview";
  return {
    title: `${name} · client deliverable preview`,
    description: "Per-client factory preview. Internal noindex. Not auto-published.",
    robots: { index: false, follow: false },
  };
}

export default async function ClientDeliverableHome({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  if (!project) notFound();

  const config = configFromProject(project);
  const styleId = (project.designStyleId || config.designStyleId) as DesignStyleId;
  const style = DESIGN_STYLES.find((item) => item.id === styleId) || DESIGN_STYLES[0];
  // Built only from the client's own details: no showcase prices, testimonials or Sitesinc branding.
  const preview = buildClientPreviewModel(config);

  const workspace = await readClientWorkspace(projectId);
  const cityPages = approvedEntries(await readCityIndex(projectId).catch(() => null));
  const pages = project.seededPages?.length
    ? project.seededPages
    : config.seededPages;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
        Client deliverable preview · project {projectId} · noindex · not Netlify-published
      </p>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div>
          <p className="text-lg font-semibold">{config.businessName}</p>
          <p className="text-xs text-zinc-400">{preview.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm text-zinc-300">
          {pages.map((page) => (
            <Link
              key={page.slug}
              href={
                page.slug === "home"
                  ? `/demo/client/${projectId}`
                  : `/demo/client/${projectId}/${page.slug}`
              }
              className="hover:text-white"
            >
              {page.slug === "home" ? "Home" : page.title.split("·")[0].trim()}
            </Link>
          ))}
          {cityPages.length ? (
            <Link href={`/demo/client/${projectId}/locations`} className="hover:text-white">
              Locations
            </Link>
          ) : null}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-6 pb-16">
        <section
          className="overflow-hidden rounded-3xl border border-white/10 bg-black/40"
          style={{ boxShadow: `0 0 0 1px ${style.accent}22` }}
        >
          <div className="px-6 py-12 sm:px-10" style={{ background: `linear-gradient(135deg, ${style.accent}26, transparent 60%)` }}>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{preview.businessName}</h1>
            {preview.tagline ? <p className="mt-3 max-w-2xl text-base text-zinc-300">{preview.tagline}</p> : null}
            {preview.cta ? (
              <a
                href={preview.cta.href}
                className="mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-950"
                style={{ backgroundColor: style.accent }}
              >
                {preview.cta.label}
              </a>
            ) : null}
          </div>
          <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-2 sm:p-8">
            {preview.sections.map((section) => (
              <div key={section.slug} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold text-white">{section.title}</h2>
                <p className={`mt-2 text-sm ${section.placeholder ? "italic text-amber-200/80" : "text-zinc-300"}`}>
                  {section.text}
                </p>
              </div>
            ))}
          </div>
          <footer className="border-t border-white/10 px-6 py-4 text-xs text-zinc-400 sm:px-8">
            {preview.contactLines.join(" · ")}
            {preview.pricingNote ? ` · Pricing: ${preview.pricingNote}` : ""}
            {` · Template ${config.templateId} · Design ${style.name}`}
          </footer>
        </section>
        {cityPages.length ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300">
            <h2 className="text-base font-semibold text-white">
              Service areas ({cityPages.length} approved city page{cityPages.length === 1 ? "" : "s"})
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {cityPages.slice(0, 60).map((page) => (
                <Link
                  key={page.slug}
                  href={`/demo/client/${projectId}/locations/${page.slug}`}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-emerald-300 hover:border-emerald-300/50"
                >
                  {page.name}, {page.state}
                </Link>
              ))}
              <Link href={`/demo/client/${projectId}/locations`} className="px-3 py-1 text-xs text-zinc-400 hover:text-white">
                All locations →
              </Link>
            </div>
          </section>
        ) : null}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300">
          <h2 className="text-base font-semibold text-white">Planned pages (from template)</h2>
          <ul className="mt-3 space-y-2">
            {pages.map((page) => {
              const drafted = workspace?.pages.find((row) => row.slug === page.slug);
              return (
                <li key={page.slug} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <Link
                      className="text-emerald-300 hover:underline"
                      href={
                        page.slug === "home"
                          ? `/demo/client/${projectId}`
                          : `/demo/client/${projectId}/${page.slug}`
                      }
                    >
                      {page.path}
                    </Link>{" "}
                    — {plannedPagePurpose(config.templateId, page)}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {drafted?.status || "planned"}
                    {page.targetKeywords?.length ? ` · ${page.targetKeywords.join(", ")}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">
            Design bound: {style.id}. Template: {config.templateId}. Operator detail:{" "}
            <Link className="text-emerald-300 hover:underline" href={`/app/clients/${projectId}`}>
              /app/clients/{projectId}
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
