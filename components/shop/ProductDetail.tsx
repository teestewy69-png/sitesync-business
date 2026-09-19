"use client";

import type { Product } from "@/data/products";
import ProductActions from "@/components/shop/ProductActions";
import ProductImage from "@/components/shop/ProductImage";

export default function ProductDetail({ product }: { product: Product }) {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="relative min-h-[280px] overflow-hidden rounded-[28px] border border-white/10">
        <ProductImage
          product={product}
          className="absolute inset-0 h-full w-full min-h-[280px]"
        />
        {product.badge ? (
          <span className="absolute top-5 left-5 rounded-full bg-brand-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40 backdrop-blur">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
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

        <p className="text-base leading-relaxed text-slate-400">
          {product.description}
        </p>

        <ProductActions product={product} />
      </div>
    </div>
  );
}
