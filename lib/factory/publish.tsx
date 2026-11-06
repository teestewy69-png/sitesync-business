import OrgJsonLd from "@/components/OrgJsonLd";
import ServiceJsonLd from "@/components/ServiceJsonLd";
import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import Link from "next/link";
import SitePage from "@/components/SitePage";
import { PAGE_DRAFTS, PAGE_FAQS } from "@/lib/factory/drafts";
import { parseDraftBlocks } from "@/lib/factory/draft-blocks";
import { readPublicWorkspace } from "@/lib/factory/workspace";
import type { FactoryPage } from "@/lib/factory/types";
import { findRetiredOfferClaim } from "@/lib/offer-copy";
import { metadataForFactoryPage } from "@/lib/factory/page-metadata";
import { SITE_HUB_LINKS } from "@/lib/site-nav";

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+?\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        return bold ? <strong key={index}>{bold[1]}</strong> : <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

export { metadataForFactoryPage } from "@/lib/factory/page-metadata";

// Public readers degrade: if the store fails or the workspace is corrupt they log and return null
// (-> notFound / noindex metadata) instead of a 500. /app pages stay strict.
export async function getPublishedPage(slug: string): Promise<FactoryPage | null> {
  const workspace = await readPublicWorkspace();
  if (!workspace) return null;
  const page = workspace.pages.find((item) => item.slug === slug);
  if (!page) return null;
  if (page.status !== "published" || page.noindex) return null;
  if (!page.body.trim()) return null;
  // In-repo PAGE_DRAFTS are the current reviewed public copy for hub slugs. Prefer them over a
  // stale workspace document so title/canonical/copy fixes ship without a factory republish.
  // Re-publishing from /app still updates the stored copy for good.
  const draft = PAGE_DRAFTS[slug];
  if (draft) {
    const stale = findRetiredOfferClaim(`${page.title}\n${page.metaDescription}\n${page.body}`);
    if (stale) console.warn(`Published page ${slug} carries retired offer copy; serving the current draft.`);
    return { ...page, ...draft };
  }
  const stale = findRetiredOfferClaim(`${page.title}\n${page.metaDescription}\n${page.body}`);
  if (stale) return null;
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
  return metadataForFactoryPage(page, { blockIndexing });
}

export function FactoryArticle({
  page,
  staged = false,
  lead,
}: {
  page: FactoryPage;
  staged?: boolean;
  lead?: ReactNode;
}) {
  const blocks = parseDraftBlocks(page.body);
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
        {page.title.replace(/\s*\|\s*Sitesinc$/, "")}
      </h1>
      {page.metaDescription ? (
        <p className="mt-3 text-base text-slate-300">{page.metaDescription}</p>
      ) : null}
      {lead}
      <div className="mt-8 space-y-4 text-base leading-7 text-slate-200">
        {blocks.map((block, index) => {
          if (block.type === "heading") {
            if (block.level === 3) {
              return (
                <h3 key={index} className="pt-2 text-lg font-semibold text-white">
                  <InlineText text={block.text} />
                </h3>
              );
            }
            return (
              <h2 key={index} className="pt-4 text-xl font-semibold text-white">
                <InlineText text={block.text} />
              </h2>
            );
          }
          if (block.type === "list") {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={index}
                className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ListTag>
            );
          }
          return (
            <p key={index}>
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  <InlineText text={line} />
                </Fragment>
              ))}
            </p>
          );
        })}
      </div>
      <nav aria-label="Related Sitesinc pages" className="mt-10 border-t border-white/10 pt-6">
        <p className="text-sm font-medium text-slate-200">Related pages</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {SITE_HUB_LINKS.filter((link) => link.href !== page.path && link.href !== `/${page.slug}`).map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-brand-300 hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}

export async function PublishedOrNotFound({ slug, lead }: { slug: string; lead?: ReactNode }) {
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
    <SitePage>
      <OrgJsonLd />
      <ServiceJsonLd
        name={page.title.replace(/\s*\|\s*Sitesinc$/, "")}
        description={page.metaDescription}
        path={page.path || `/${page.slug}`}
        faqs={PAGE_FAQS[slug] || []}
      />
      <FactoryArticle page={page} staged={preview || page.noindex} lead={lead} />
    </SitePage>
  );
}
