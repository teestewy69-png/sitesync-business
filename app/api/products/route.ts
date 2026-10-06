import { NextResponse } from "next/server";
import { canBuyOnline, visibleProducts } from "@/lib/public-catalog";

export const runtime = "nodejs";

/**
 * Public catalog: listed entries only. Drafts, unlisted and retired entries never appear here, and while SiteFlow
 * is paused (Path A) only the contact-only inquiry entries are returned and nothing is purchasable.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    products: visibleProducts().map((product) => ({
      slug: product.slug,
      name: product.name,
      category: product.category,
      kind: product.kind,
      price: product.price ?? null,
      purchasable: canBuyOnline(product),
      contactOnly: Boolean(product.contactOnly),
      description: product.description,
      image: product.image,
    })),
  });
}
