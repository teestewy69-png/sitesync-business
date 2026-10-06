/**
 * What visitors may see of the catalog right now (server only). data/products.ts stays import-free for the
 * Stripe sync script, so the SiteFlow pause is applied here: while SiteFlow is paused (Path A) only the
 * contact-only inquiry entries are public and nothing is purchasable, whatever `listed`/`priceCents` say.
 */
import { getPublicProducts, isPurchasable, type CatalogEntry, type Product } from "@/data/products";
import { siteflowEnabled } from "@/lib/siteflow/flag";

export function visibleProducts(env: Record<string, string | undefined> = process.env): Product[] {
  const on = siteflowEnabled(env);
  return getPublicProducts().filter((p) => on || p.contactOnly === true);
}

export function visibleProduct(slug: string, env: Record<string, string | undefined> = process.env): Product | undefined {
  return visibleProducts(env).find((p) => p.slug === slug);
}

/** Can a visitor pay for this online right now? Never while SiteFlow is paused. */
export function canBuyOnline(product: CatalogEntry, env: Record<string, string | undefined> = process.env): boolean {
  return siteflowEnabled(env) && isPurchasable(product);
}

/** Is anything at all purchasable? Drives whether cart/checkout links are shown. */
export function anythingPurchasable(env: Record<string, string | undefined> = process.env): boolean {
  return visibleProducts(env).some((p) => canBuyOnline(p, env));
}
