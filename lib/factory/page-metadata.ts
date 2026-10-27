import type { Metadata } from "next";
import type { FactoryPage } from "@/lib/factory/types";
import { OG_IMAGE } from "@/lib/og-image";

/** Self-referencing canonical + og:url so hub pages do not inherit the homepage from the root layout. */
export function metadataForFactoryPage(
  page: Pick<FactoryPage, "title" | "metaDescription" | "path" | "slug">,
  { blockIndexing }: { blockIndexing: boolean }
): Metadata {
  const path = page.path || `/${page.slug}`;
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: path,
      images: [OG_IMAGE],
    },
    robots: blockIndexing ? { index: false, follow: false } : { index: true, follow: true },
  };
}
