export type Product = {
  slug: string;
  name: string;
  category: string;
  price?: string;
  regularPrice?: string;
  contactOnly?: boolean;
  description: string;
  badge?: string;
  stripeUrl?: string;
  image: string;
};

export const products: Product[] = [
  {
    slug: "website-design-digital-bundle",
    name: "Website Design Digital Product Bundle",
    category: "Digital Products",
    price: "$24.99",
    regularPrice: "$49.99",
    description:
      "Digital products relating to website design, performance, SEO, and online business foundations.",
    badge: "50% Off",
    stripeUrl: "https://buy.stripe.com/00w28r2eN5Xb3uBcEia3u04",
    image: "/products/website-design-digital-bundle.jpg",
  },
];

/** Prefer explicit `image` as the source of truth (JPG when present). */
export function getProductImageSrc(product: Product): string {
  return product.image || `/products/${product.slug}.jpg`;
}

/** SVG placeholder under public/products/{slug}.svg when the JPG is missing. */
export function getProductImageFallbackSrc(product: Product): string {
  return `/products/${product.slug}.svg`;
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/** Parse "$24.99" → 24.99. Returns 0 for contact-only / missing prices. */
export function parsePrice(price?: string): number {
  if (!price) return 0;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
