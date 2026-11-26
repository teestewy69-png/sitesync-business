import type { Product } from "@/data/products";
import { productNode, serviceNode } from "@/lib/siteflow/product-schema";

/**
 * Product + Offer JSON-LD for a /store/[slug] landing page (store opened to
 * search/AI by Tony's decision, 2026-11-25). Node construction lives in
 * lib/siteflow/product-schema.ts so the store index and lane ItemLists carry
 * the identical Product markup. A subscription (Website Monitoring) is also
 * a performed service, so its page adds the matching Service node.
 */
export default function ProductJsonLd({ product }: { product: Product }) {
  const data =
    product.kind === "subscription"
      ? {
          "@context": "https://schema.org",
          "@graph": [productNode(product), serviceNode(product)],
        }
      : { "@context": "https://schema.org", ...productNode(product) };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
