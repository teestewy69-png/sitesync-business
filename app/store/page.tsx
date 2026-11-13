import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/siteflow/AddToCartButton";
import ProductImage from "@/components/siteflow/ProductImage";
import { getPublicProducts } from "@/data/products";
import { siteflowEnabled } from "@/lib/siteflow/flag";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!siteflowEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: "Store | Sitesinc",
    description:
      "Sitesinc website monitoring: 1st month free, then $129/mo. Uptime checks, basic technical updates, and small monthly edits. Cancel anytime.",
    // Deliberately unlisted like /tools: no sitemap or navigation entry.
    robots: { index: false, follow: false },
  };
}

/**
 * SiteFlow storefront (Tony launch decision, 2026-11-08). The old /shop pages were removed
 * in the 2026-10-05 pause and /shop still 301s to / in middleware, so the store lives at
 * /store. It lists only the public catalog (getPublicProducts: listed + priced) and feeds
 * the existing cart: AddToCartButton writes to CartProvider, /cart reviews, and /checkout
 * collects each product's fulfillmentInputs and posts them to /api/checkout, which
 * re-prices and validates everything server-side (lib/catalog.ts quoteCart).
 */
export default function StorePage() {
  // Self-gated like app/tools/page.tsx (the layout gates too; /store is not a
  // middleware-paused path, so the page must answer 404 itself while paused).
  if (!siteflowEnabled()) notFound();
  const products = getPublicProducts();

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-black px-6 py-16 text-white">
      <h1 className="text-3xl font-semibold tracking-tight">Store</h1>
      <p className="mt-3 text-base text-slate-300">
        Add Sitesinc website monitoring to a site we built for you. The 1st month is
        free, then it is $129/mo. Monitoring is a monthly subscription you can cancel
        anytime.
      </p>

      {products.length === 0 ? (
        <p className="mt-8 text-base text-slate-300">Nothing is on sale right now.</p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {products.map((product) => (
            <li
              key={product.slug}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex gap-4">
                <ProductImage
                  product={product}
                  className="h-20 w-20 shrink-0 rounded-2xl"
                  imgClassName="absolute inset-0 h-full w-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    {product.category}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    <Link href={`/store/${product.slug}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{product.description}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-50">
                    {product.price}
                  </p>
                  {product.disclosure ? (
                    <p className="mt-1 text-xs text-amber-200" data-disclosure="billing">
                      {product.disclosure}
                    </p>
                  ) : null}
                  {product.fulfillmentInputs?.length ? (
                    <p className="mt-2 text-xs text-slate-400">
                      At checkout we ask for{" "}
                      {product.fulfillmentInputs
                        .map((field) => field.label.toLowerCase())
                        .join(", ")}
                      , so we can prepare it for your business.
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <AddToCartButton slug={product.slug} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-slate-400">
        Already added something?{" "}
        <Link href="/cart" className="font-semibold text-brand-300 hover:underline">
          Review your cart
        </Link>{" "}
        or{" "}
        <Link href="/checkout" className="font-semibold text-brand-300 hover:underline">
          go to checkout
        </Link>
        .
      </p>
    </main>
  );
}
