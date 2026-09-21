"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/shop/CartProvider";
import ProductImage from "@/components/shop/ProductImage";
import { formatMoney, parsePrice } from "@/data/products";

export default function CartPage() {
  const { lines, subtotal, setQuantity, removeItem, getLineProduct } = useCart();
  const [working, setWorking] = useState<string | null>(null);

  const items = useMemo(
    () =>
      lines
        .map((line) => {
          const product = getLineProduct(line.slug);
          return product ? { line, product } : null;
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [getLineProduct, lines]
  );

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Cart
        </h1>
        <p className="mt-3 text-base text-slate-300">
          Your cart is empty. Browse the shop and add a bundle when you&apos;re
          ready.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
        >
          Browse the shop
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Cart
      </h1>
      <p className="mt-3 text-base text-slate-300">
        Review your items, then continue to checkout. Totals are calculated
        from the live catalog.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {items.map(({ line, product }) => (
            <div
              key={line.slug}
              className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <ProductImage
                product={product}
                className="h-20 w-20 shrink-0 rounded-2xl"
                imgClassName="absolute inset-0 h-full w-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-50">
                      {product.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {product.price}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-slate-50">
                    {formatMoney(parsePrice(product.price) * line.quantity)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="text-xs uppercase tracking-wider text-slate-400">
                    Qty
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={line.quantity}
                      disabled={working === line.slug}
                      onChange={(event) => {
                        setWorking(line.slug);
                        setQuantity(line.slug, Number(event.target.value));
                        setWorking(null);
                      }}
                      className="ml-2 w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeItem(line.slug)}
                    className="text-sm text-slate-400 transition hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-slate-50">Order Summary</h2>
          <div className="mt-4 space-y-2 text-base text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Tax</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3 font-semibold text-slate-50">
              <span>Total</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </section>
  );
}
