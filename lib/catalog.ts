import { getProduct, parsePrice, type Product } from "@/data/products";
import type { OrderItem } from "@/lib/store";
import { asQuantity } from "@/lib/validate";

export type QuotedCart = {
  items: OrderItem[];
  subtotal: number;
};

export function quoteCart(
  lines: { slug?: unknown; quantity?: unknown }[]
): QuotedCart {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const merged = new Map<string, number>();
  for (const line of lines) {
    const slug = typeof line.slug === "string" ? line.slug.trim() : "";
    const quantity = asQuantity(line.quantity);
    if (!slug || quantity < 1) continue;
    merged.set(slug, Math.min(99, (merged.get(slug) ?? 0) + quantity));
  }

  if (merged.size === 0) {
    throw new Error("Your cart is empty.");
  }

  const items: OrderItem[] = [];
  for (const [slug, quantity] of merged) {
    const product = getProduct(slug);
    if (!product) {
      throw new Error(`Unknown product: ${slug}`);
    }
    if (product.contactOnly) {
      throw new Error(`${product.name} is inquiry-only and cannot be checked out.`);
    }
    const unitAmount = parsePrice(product.price);
    items.push({
      slug,
      name: product.name,
      quantity,
      unitAmount,
      lineTotal: Number((unitAmount * quantity).toFixed(2)),
    });
  }

  const subtotal = Number(
    items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
  );
  return { items, subtotal };
}

export function requireProduct(slug: string): Product {
  const product = getProduct(slug);
  if (!product) {
    throw new Error("That product was not found.");
  }
  return product;
}
