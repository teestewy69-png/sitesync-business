import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClientWorksGrid from "@/components/factory/ClientWorksGrid";
import DraftBody from "@/components/factory/DraftBody";
import { assetByRole, clientAssetUrl, isOperatorCopy, previewWorks, suppliedContentFrom } from "@/lib/factory/client-content";
import { configFromProject } from "@/lib/factory/client-config";
import { draftFromClientBrief } from "@/lib/factory/client-drafts";
import { plannedPagePurpose } from "@/lib/factory/client-templates";
import { readClientWorkspace } from "@/lib/factory/client-workspace";
import { findProjectById } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Client page preview",
};

export default async function ClientDeliverablePage({
  params,
}: {
  params: Promise<{ projectId: string; slug: string }>;
}) {
  const { projectId, slug } = await params;
  const project = await findProjectById(projectId);
  if (!project) notFound();

  const config = configFromProject(project);
  const seeded = (project.seededPages?.length ? project.seededPages : config.seededPages).find(
    (page) => page.slug === slug
  );
  if (!seeded) notFound();

  const workspace = await readClientWorkspace(projectId);
  const page = workspace?.pages.find((row) => row.slug === slug);
  const brief = workspace?.briefs.find((row) => row.slug === slug || row.id === page?.briefId);

  let title = page?.title || seeded.title;
  let body = page?.body || "";
  let headings = page?.headings || [];

  if (!body.trim() && brief) {
    const draft = draftFromClientBrief(brief, config, suppliedContentFrom(workspace?.clientContent));
    title = draft.title;
    body = draft.body;
    headings = draft.headings;
  }

  if (!body.trim()) {
    body = [
      `# ${title}`,
      "",
      plannedPagePurpose(config.templateId, seeded),
      "",
      `Business: ${config.businessName}. Niche: ${config.niche}.`,
      config.city ? `Location: ${config.city}${config.state ? `, ${config.state}` : ""}.` : "",
      "",
      "No approved draft body yet. This slot is seeded from the bound template.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const portfolioTemplate = config.templateId === "portfolio";
  // Supplied content first: the full artwork list on /portfolio, the artist photo on /about.
  const works = portfolioTemplate && slug === "portfolio" ? previewWorks(projectId, workspace?.clientContent, config.pricingNote) : [];
  const photoAsset = portfolioTemplate && slug === "about" ? assetByRole(workspace?.clientContent, "artist-photo") : null;
  const operatorCopy = isOperatorCopy(page);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
        Client page preview · {projectId}/{slug} · noindex{operatorCopy ? " · client copy (needs approval)" : ""}
      </p>
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-5">
        <Link href={`/demo/client/${projectId}`} className="text-sm text-emerald-300 hover:underline">
          ← {config.businessName}
        </Link>
        <span className="text-xs text-zinc-500">{page?.status || "planned"}</span>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-6 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {headings.length > 0 && !operatorCopy ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
            {headings.map((heading) => (
              <li key={heading}>{heading}</li>
            ))}
          </ul>
        ) : null}
        {photoAsset ? (
          // eslint-disable-next-line @next/next/no-img-element -- client upload served from the factory store
          <img
            src={clientAssetUrl(projectId, photoAsset.filename)}
            alt={photoAsset.alt}
            className="max-h-96 w-auto rounded-2xl object-cover"
          />
        ) : null}
        <DraftBody body={body} />
        {works.length ? (
          <section className="pt-4">
            <h2 className="pb-3 text-2xl font-semibold tracking-tight text-white">Works ({works.length})</h2>
            <ClientWorksGrid works={works} />
          </section>
        ) : null}
        {brief ? (
          <p className="text-xs text-zinc-500">
            Brief {brief.id} · competitorUrls:{" "}
            {brief.competitorUrls.length ? brief.competitorUrls.join(", ") : "none (attach top 3)"}
          </p>
        ) : null}
      </main>
    </div>
  );
}
