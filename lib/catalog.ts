import {
  getProduct,
  isPurchasable,
  type FulfillmentInput,
  type Product,
} from "@/data/products";
import type { OrderItem } from "@/lib/store";
import { asQuantity } from "@/lib/validate";

export type QuotedCart = {
  items: OrderItem[];
  subtotal: number;
  subtotalCents: number;
  /** Any recurring item makes the Stripe session a subscription session. */
  mode: "payment" | "subscription";
  /** Only physical goods need a postal address. Digital and service carts never ask for one. */
  requiresShipping: boolean;
  /** Per-product inputs the buyer gave for generated / service deliverables. */
  fulfillmentInputs: Record<string, Record<string, string>>;
};

export type CartLineInput = {
  slug?: unknown;
  quantity?: unknown;
  inputs?: unknown;
};

function cleanInput(field: FulfillmentInput, raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().slice(0, field.maxLength) : "";
  if (!value) return "";
  if (field.kind === "url") {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withScheme);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.toString();
    } catch {
      return "";
    }
  }
  return value;
}

/** Validate the extra inputs a product needs (e.g. the site URL for an SEO audit). Throws a buyer-facing message. */
export function validateFulfillmentInputs(product: Product, raw: unknown): Record<string, string> {
  const fields = product.fulfillmentInputs || [];
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = cleanInput(field, source[field.key]);
    if (!value && field.required) {
      throw new Error(`${product.name}: please enter ${field.label.toLowerCase()}.`);
    }
    if (value) out[field.key] = value;
  }
  return out;
}

export function quoteCart(lines: CartLineInput[]): QuotedCart {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const merged = new Map<string, { quantity: number; inputs: unknown }>();
  for (const line of lines) {
    const slug = typeof line.slug === "string" ? line.slug.trim() : "";
    const quantity = asQuantity(line.quantity);
    if (!slug || quantity < 1) continue;
    const prev = merged.get(slug);
    merged.set(slug, {
      quantity: Math.min(99, (prev?.quantity ?? 0) + quantity),
      inputs: line.inputs ?? prev?.inputs,
    });
  }

  if (merged.size === 0) {
    throw new Error("Your cart is empty.");
  }

  const items: OrderItem[] = [];
  const fulfillmentInputs: Record<string, Record<string, string>> = {};
  const intervals = new Set<string>();
  let requiresShipping = false;

  for (const [slug, line] of merged) {
    const product = getProduct(slug);
    if (!product) {
      throw new Error(`Unknown product: ${slug}`);
    }
    if (product.contactOnly) {
      throw new Error(`${product.name} is inquiry-only and cannot be checked out.`);
    }
    if (!isPurchasable(product) || typeof product.priceCents !== "number") {
      throw new Error(`${product.name} is not for sale yet.`);
    }
    // Subscriptions and generated reports are one per order (each needs its own inputs).
    const quantity =
      product.kind === "subscription" || product.deliverable?.type === "generator" ? 1 : line.quantity;
    if (product.kind === "subscription") intervals.add(product.interval || "month");
    if (product.requiresShipping) requiresShipping = true;
    const inputs = validateFulfillmentInputs(product, line.inputs);
    if (Object.keys(inputs).length) fulfillmentInputs[slug] = inputs;

    const unitAmountCents = product.priceCents;
    items.push({
      slug,
      name: product.name,
      quantity,
      unitAmount: unitAmountCents / 100,
      unitAmountCents,
      lineTotal: Number(((unitAmountCents * quantity) / 100).toFixed(2)),
      kind: product.kind,
      ...(product.kind === "subscription" ? { interval: product.interval || "month" } : {}),
      ...(product.stripeLookupKey ? { stripeLookupKey: product.stripeLookupKey } : {}),
    });
  }

  if (intervals.size > 1) {
    throw new Error("Monthly and yearly plans must be checked out separately.");
  }

  const subtotalCents = items.reduce((sum, item) => sum + (item.unitAmountCents ?? 0) * item.quantity, 0);
  return {
    items,
    subtotal: Number((subtotalCents / 100).toFixed(2)),
    subtotalCents,
    mode: intervals.size ? "subscription" : "payment",
    requiresShipping,
    fulfillmentInputs,
  };
}

export function requireProduct(slug: string): Product {
  const product = getProduct(slug);
  if (!product) {
    throw new Error("That product was not found.");
  }
  return product;
}
