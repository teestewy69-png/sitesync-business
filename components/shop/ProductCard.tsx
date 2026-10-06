"use client";

import Link from "next/link";
import { parsePrice, type Product } from "@/data/products";
import { useCart } from "@/components/shop/CartProvider";
import ProductImage from "@/components/shop/ProductImage";
import { trackAddToCart, trackSelectItem, type AnalyticsItem } from "@/lib/analytics";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const analyticsItem: AnalyticsItem = {
    item_id: product.slug,
    item_name: product.name,
    item_category: product.category,
    price: parsePrice(product.price),
    quantity: 1,
  };
  const onSelect = () => trackSelectItem("shop", analyticsItem);

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-brand-400/40">
      <Link
        href={`/shop/product/${product.slug}`}
        onClick={onSelect}
        className="relative block aspect-[4/3] border-b border-white/10"
      >
        <ProductImage product={product} className="absolute inset-0 h-full w-full" />
        {product.badge ? (
          <span className="absolute top-3 right-3 rounded-full bg-brand-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40 backdrop-blur">
            {product.badge}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          {product.category}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          <Link
            href={`/shop/product/${product.slug}`}
            onClick={onSelect}
            className="hover:text-brand-200"
          >
            {product.name}
          </Link>
        </h2>
        <p className="mt-2 flex-1 text-base text-slate-400">{product.description}</p>

        <div className="mt-4 flex items-baseline gap-2">
          {product.contactOnly ? (
            <span className="text-sm font-semibold text-brand-300">
              Contact for pricing
            </span>
          ) : (
            <span className="text-xl font-semibold text-white">
              {product.price}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/shop/product/${product.slug}`}
            onClick={onSelect}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-brand-400/50"
          >
            View
          </Link>
          {product.contactOnly ? (
            <Link
              href={`/shop/product/${product.slug}`}
              onClick={onSelect}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
            >
              Request a quote
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                addItem(product.slug);
                trackAddToCart(analyticsItem);
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
