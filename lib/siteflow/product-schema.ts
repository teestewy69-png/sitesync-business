import content from "@/content.json";
import type { Product } from "@/data/products";

/**
 * Schema.org node builders for the store (opened to search/AI by Tony's
 * decision, 2026-11-25). Shared by the product landing pages and the
 * ItemLists on the store index / lane pages so a product's markup is
 * identical wherever it appears. Facts come from data/products.ts only:
 * the Offer price is the catalog priceCents rendered as dollars, never the
 * display text. A subscription's Offer also carries a UnitPriceSpecification
 * so its price reads as recurring monthly, exactly as the catalog models it
 * (interval "month"; the free-trial terms live in the page's own billing
 * disclosure, not hidden in schema).
 */

export function offerNode(product: Product, url: string): Record<string, unknown> {
  const price =
    typeof product.priceCents === "number" ? (product.priceCents / 100).toFixed(2) : undefined;

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  };
  if (price !== undefined) {
    offer.price = price;
    if (product.kind === "subscription") {
      offer.priceSpecification = {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: "USD",
        billingIncrement: 1,
        unitText: "MON",
      };
    }
  }
  return offer;
}

export function productNode(product: Product): Record<string, unknown> {
  const origin = content.seo.url;
  const url = `${origin}/store/${product.slug}`;
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.description,
    category: product.category,
    image: `${origin}${product.image}`,
    brand: { "@type": "Brand", name: "SitesInc" },
    offers: offerNode(product, url),
  };
}

/**
 * The monitoring subscription is a service as well as a product (the catalog
 * deliverable is manual: Tony performs it by hand). Its landing page carries
 * this Service node next to the Product node, mirroring how SeoJsonLd models
 * the build offer as a Service.
 */
export function serviceNode(product: Product): Record<string, unknown> {
  const origin = content.seo.url;
  const url = `${origin}/store/${product.slug}`;
  return {
    "@type": "Service",
    "@id": `${url}#service`,
    name: product.name,
    serviceType: product.name,
    description: product.description,
    provider: { "@id": `${origin}/#organization` },
    offers: offerNode(product, url),
  };
}
