import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGE_DRAFTS } from "@/lib/factory/drafts";
import { ensureWorkspace } from "@/lib/factory/workspace";
import type { FactoryPage } from "@/lib/factory/types";

export async function getPublishedPage(slug: string): Promise<FactoryPage | null> {
  const workspace = await ensureWorkspace();
  const page = workspace.pages.find((item) => item.slug === slug);
  if (!page) return null;
  if (page.status !== "published" || page.noindex) return null;
  if (!page.body.trim()) return null;
  return page;
}

export async function getPreviewPage(slug: string): Promise<FactoryPage | null> {
  const workspace = await ensureWorkspace();
  const page = workspace.pages.find((item) => item.slug === slug);
  if (!page || !page.body.trim()) return null;
  if (page.status === "staged" || page.status === "published" || page.status === "approved") {
    const draft = PAGE_DRAFTS[slug];
    return draft ? { ...page, ...draft } : page;
  }
  return null;
}

export async function factoryPageMetadata(slug: string): Promise<Metadata> {
  const { isPreviewRequest } = await import("./preview");
  const preview = await isPreviewRequest();
  const page = preview ? await getPreviewPage(slug) : await getPublishedPage(slug);
  if (!page) {
    return { robots: { index: false, follow: false } };
  }
  return {
    title: page.title,
    description: page.metaDescription,
    robots: preview ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export function FactoryArticle({ page, staged = false }: { page: FactoryPage; staged?: boolean }) {
  const paragraphs = page.body.split(/\n{2,}/).filter(Boolean);
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      {staged && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Staging preview — noindex. This is not the live production page.
        </p>
      )}
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
        Sitesinc factory
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {page.title}
      </h1>
      {page.metaDescription ? (
        <p className="mt-3 text-base text-slate-300">{page.metaDescription}</p>
      ) : null}
      <div className="mt-8 space-y-4 text-base leading-7 text-slate-200">
        {paragraphs.map((block) => {
          if (block.startsWith("## ")) {
            return (
              <h2 key={block} className="pt-4 text-xl font-semibold text-white">
                {block.replace(/^## /, "")}
              </h2>
            );
          }
          if (block.startsWith("# ")) {
            return (
              <h2 key={block} className="pt-4 text-xl font-semibold text-white">
                {block.replace(/^# /, "")}
              </h2>
            );
          }
          return <p key={block}>{block}</p>;
        })}
      </div>
    </article>
  );
}

export async function PublishedOrNotFound({ slug }: { slug: string }) {
  const { isPreviewRequest } = await import("./preview");
  const preview = await isPreviewRequest();
  const page = preview ? await getPreviewPage(slug) : await getPublishedPage(slug);
  if (!page) notFound();
  return (
    <main className="min-h-screen bg-black text-white">
      <FactoryArticle page={page} staged={preview || page.noindex} />
    </main>
  );
}
