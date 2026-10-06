import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { PAGE_DRAFTS } from "@/lib/factory/drafts";
import { readPublicWorkspace } from "@/lib/factory/workspace";
import type { FactoryPage } from "@/lib/factory/types";
import { findRetiredOfferClaim } from "@/lib/offer-copy";

// Public readers degrade: if the store fails or the workspace is corrupt they log and return null
// (-> notFound / noindex metadata) instead of a 500. /app pages stay strict.
export async function getPublishedPage(slug: string): Promise<FactoryPage | null> {
  const workspace = await readPublicWorkspace();
  if (!workspace) return null;
  const page = workspace.pages.find((item) => item.slug === slug);
  if (!page) return null;
  if (page.status !== "published" || page.noindex) return null;
  if (!page.body.trim()) return null;
  // Path A guard: a page published before the offer cleanup may still carry retired claims (Stripe checkout,
  // monetization placeholders, digital products...). Serve the current reviewed draft for that slug instead,
  // or nothing if there is no draft. Re-publishing from /app replaces the stored copy for good.
  const stale = findRetiredOfferClaim(`${page.title}\n${page.metaDescription}\n${page.body}`);
  if (stale) {
    const draft = PAGE_DRAFTS[slug];
    if (!draft) return null;
    console.warn(`Published page ${slug} carries retired offer copy; serving the current draft.`);
    return { ...page, ...draft };
  }
  return page;
}

export async function getPreviewPage(slug: string): Promise<FactoryPage | null> {
  const workspace = await readPublicWorkspace();
  if (!workspace) return null;
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
  const { isStagingEnv } = await import("@/lib/site-env");
  let page: FactoryPage | null = null;
  let preview = false;
  try {
    preview = await isPreviewRequest();
    page = preview ? await getPreviewPage(slug) : await getPublishedPage(slug);
  } catch (err) {
    unstable_rethrow(err);
    console.error("factoryPageMetadata fallback:", err instanceof Error ? err.name : "unknown");
  }
  if (!page) {
    return { robots: { index: false, follow: false } };
  }
  const blockIndexing = preview || isStagingEnv();
  return {
    title: page.title,
    description: page.metaDescription,
    robots: blockIndexing ? { index: false, follow: false } : { index: true, follow: true },
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
  let page: FactoryPage | null = null;
  let preview = false;
  try {
    preview = await isPreviewRequest();
    page = preview ? await getPreviewPage(slug) : await getPublishedPage(slug);
  } catch (err) {
    unstable_rethrow(err);
    console.error("PublishedOrNotFound fallback:", err instanceof Error ? err.name : "unknown");
  }
  if (!page) notFound();
  return (
    <main className="min-h-screen bg-black text-white">
      <FactoryArticle page={page} staged={preview || page.noindex} />
    </main>
  );
}
