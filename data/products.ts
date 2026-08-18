import type { StaticImageData } from "next/image";
import financialConsulting from "@/public/products/financial-consulting.jpg";
import goldFilledJewelry from "@/public/products/gold-filled-jewelry.jpg";
import homeGymBundle from "@/public/products/home-gym-bundle.jpg";
import homePetGroomingKit from "@/public/products/home-pet-grooming-kit.jpg";
import longevityLifeBundle from "@/public/products/longevity-life-bundle.jpg";
import mackMakeupBundle from "@/public/products/mack-makeup-bundle.jpg";
import websiteDesignBundle from "@/public/products/website-design-digital-bundle.jpg";

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
  /** Optimized static import so the photo ships in the Next.js build. */
  image: StaticImageData;
  /** Public JPG filename used for offline / ZIP exports. */
  imageFile: string;
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
    image: websiteDesignBundle,
    imageFile: "website-design-digital-bundle.jpg",
  },
  {
    slug: "mack-makeup-bundle",
    name: "Mack Makeup Bundle",
    category: "Beauty",
    price: "$75.00",
    regularPrice: "$125.00",
    description:
      "Bundle includes eyeliner, concealer, and lipstick from our affiliate beauty sources.",
    badge: "Bundle Deal",
    image: mackMakeupBundle,
    imageFile: "mack-makeup-bundle.jpg",
  },
  {
    slug: "home-gym-bundle",
    name: "Compact Home Gym Bundle",
    category: "Fitness",
    price: "$199.00",
    regularPrice: "$350.00",
    description:
      "A home gym setup offer from affiliate partners for customers building their health at home.",
    badge: "Best Value",
    image: homeGymBundle,
    imageFile: "home-gym-bundle.jpg",
  },
  {
    slug: "home-pet-grooming-kit",
    name: "Home Pet Grooming Kit",
    category: "Pet Care",
    price: "$100.00",
    regularPrice: "$225.00",
    description:
      "A home pet grooming solution including tools and essentials from affiliate product sources.",
    badge: "Hot Offer",
    image: homePetGroomingKit,
    imageFile: "home-pet-grooming-kit.jpg",
  },
  {
    slug: "longevity-life-bundle",
    name: "Longevity Life Supplement Bundle",
    category: "Supplements",
    price: "$40.99",
    regularPrice: "$75.99",
    description:
      "Turmeric, oil of oregano, and cayenne pepper bundle designed around longevity and daily wellness.",
    badge: "Limited Offer",
    image: longevityLifeBundle,
    imageFile: "longevity-life-bundle.jpg",
  },
  {
    slug: "financial-consulting",
    name: "Financial Consultation",
    category: "Consulting",
    contactOnly: true,
    description:
      "Professional financial consultation services. Contact us directly for pricing and service details.",
    image: financialConsulting,
    imageFile: "financial-consulting.jpg",
  },
  {
    slug: "gold-filled-jewelry",
    name: "24k, 18k & 14k Gold Filled Jewelry",
    category: "Jewelry",
    contactOnly: true,
    description:
      "Gold-filled jewelry from our affiliate sources. Contact us for pricing, availability, and inventory.",
    image: goldFilledJewelry,
    imageFile: "gold-filled-jewelry.jpg",
  },
];

/** Prefer the bundled static photo; falls back to the public JPG path. */
export function getProductImageSrc(product: Product): string {
  return product.image.src;
}

/** SVG placeholder under public/products/{slug}.svg when the photo is missing. */
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
