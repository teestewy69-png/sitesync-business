"use client";

import Link from "next/link";
import type { Product } from "@/data/products";
import { useCart } from "@/components/shop/CartProvider";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <article className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-brand-400/40">
      {product.badge ? (
        <span className="absolute top-4 right-4 rounded-full bg-brand-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40">
          {product.badge}
        </span>
      ) : null}

      <p className="pr-16 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
        {product.category}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-white">
        <Link
          href={`/shop/product/${product.slug}`}
          className="hover:text-brand-200"
        >
          {product.name}
        </Link>
      </h2>
      <p className="mt-2 flex-1 text-sm text-slate-400">{product.description}</p>

      <div className="mt-4 flex items-baseline gap-2">
        {product.contactOnly ? (
          <span className="text-sm font-semibold text-brand-300">
            Contact for pricing
          </span>
        ) : (
          <>
            <span className="text-xl font-semibold text-white">
              {product.price}
            </span>
            {product.regularPrice ? (
              <span className="text-sm text-slate-500 line-through">
                {product.regularPrice}
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/shop/product/${product.slug}`}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-brand-400/50"
        >
          View
        </Link>
        {product.contactOnly ? (
          <a
            href="mailto:save@sitesinc.co"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            Contact
          </a>
        ) : (
          <button
            type="button"
            onClick={() => addItem(product.slug)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}
