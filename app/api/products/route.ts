import { NextResponse } from "next/server";
import { getPublicProducts, isPurchasable } from "@/data/products";

export const runtime = "nodejs";

/** Public catalog: listed entries only. Drafts, unlisted and retired entries never appear here. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    products: getPublicProducts().map((product) => ({
      slug: product.slug,
      name: product.name,
      category: product.category,
      kind: product.kind,
      price: product.price ?? null,
      purchasable: isPurchasable(product),
      contactOnly: Boolean(product.contactOnly),
      description: product.description,
      image: product.image,
    })),
  });
}
