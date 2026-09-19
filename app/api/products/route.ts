import { NextResponse } from "next/server";
import { products } from "@/data/products";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    products: products.map((product) => ({
      slug: product.slug,
      name: product.name,
      category: product.category,
      price: product.price ?? null,
      regularPrice: product.regularPrice ?? null,
      contactOnly: Boolean(product.contactOnly),
      description: product.description,
      badge: product.badge ?? null,
      image: product.image,
    })),
  });
}
