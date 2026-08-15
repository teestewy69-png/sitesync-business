"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/data/products";
import { useCart } from "@/components/shop/CartProvider";
import ProductImage from "@/components/shop/ProductImage";

export default function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (product.contactOnly) return;
    addItem(product.slug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-white/10">
        <ProductImage
          product={product}
          className="absolute inset-0 h-full w-full min-h-[280px]"
        />
        {product.badge ? (
          <span className="absolute top-5 left-5 rounded-full bg-brand-500/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40 backdrop-blur">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
            {product.category}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {product.name}
          </h1>
        </div>

        <div className="flex items-baseline gap-3">
          {product.contactOnly ? (
            <span className="text-xl font-semibold text-brand-300">
              Contact for pricing
            </span>
          ) : (
            <>
              <span className="text-3xl font-semibold text-white">
                {product.price}
              </span>
              {product.regularPrice ? (
                <span className="text-base text-slate-500 line-through">
                  {product.regularPrice}
                </span>
              ) : null}
            </>
          )}
        </div>

        <p className="text-sm leading-relaxed text-slate-400">
          {product.description}
        </p>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          {product.contactOnly ? (
            <a
              href="mailto:save@sitesinc.co"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
            >
              Email save@sitesinc.co
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
              >
                {added ? "Added ✓" : "Add to cart"}
              </button>
              {product.stripeUrl ? (
                <a
                  href={product.stripeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-brand-400/50"
                >
                  Buy now with Stripe
                </a>
              ) : (
                <Link
                  href="/cart"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-brand-400/50"
                >
                  View cart
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
