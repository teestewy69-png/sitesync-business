import content from "@/content.json";
import type { Product } from "@/data/products";
import { productNode } from "@/lib/siteflow/product-schema";

export type StoreCrumb = { name: string; path: string };

/**
 * BreadcrumbList + ItemList JSON-LD for the store index and lane pages
 * (store opened to search/AI by Tony's decision, 2026-11-25). Mirrors the
 * breadcrumb pattern of the trades/locations clusters: first crumb is the
 * brand at the origin, then each level's own canonical URL. Each ItemList
 * entry carries the full Product node (same builder as the product pages),
 * so a listing page's products are readable — with prices — in their own
 * right, not just as names.
 */
export default function StoreJsonLd({
  crumbs,
  products,
}: {
  crumbs: StoreCrumb[];
  products: Product[];
}) {
  const origin = content.seo.url;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: crumb.name,
          item: `${origin}${crumb.path}`,
        })),
      },
      {
        "@type": "ItemList",
        itemListElement: products.map((product, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: productNode(product),
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
