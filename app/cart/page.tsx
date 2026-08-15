"use client";

import Link from "next/link";
import ShopHeader from "@/components/shop/ShopHeader";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney, parsePrice } from "@/data/products";

export default function CartPage() {
  const { lines, subtotal, setQuantity, removeItem, getLineProduct } =
    useCart();

  return (
    <main className="min-h-screen bg-black text-white">
      <ShopHeader />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
        <p className="mt-2 text-sm text-slate-400">
          Quantities update instantly. Checkout when you&apos;re ready.
        </p>

        {lines.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-slate-300">Your cart is empty.</p>
            <Link
              href="/shop"
              className="mt-4 inline-flex rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow"
            >
              Browse shop
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {lines.map((line) => {
              const product = getLineProduct(line.slug);
              if (!product) return null;
              const unit = parsePrice(product.price);
              return (
                <div
                  key={line.slug}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/shop/product/${product.slug}`}
                      className="font-semibold text-white hover:text-brand-200"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-400">
                      {product.price} each
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="sr-only" htmlFor={`qty-${line.slug}`}>
                      Quantity
                    </label>
                    <input
                      id={`qty-${line.slug}`}
                      type="number"
                      min={1}
                      max={99}
                      value={line.quantity}
                      onChange={(e) =>
                        setQuantity(line.slug, Number(e.target.value))
                      }
                      className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                    />
                    <p className="w-24 text-right text-sm font-medium text-slate-200">
                      {formatMoney(unit * line.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(line.slug)}
                      className="text-xs text-slate-500 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t border-white/10 pt-6">
              <p className="text-sm text-slate-400">Subtotal</p>
              <p className="text-xl font-semibold text-white">
                {formatMoney(subtotal)}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm text-slate-200"
              >
                Continue shopping
              </Link>
              <Link
                href="/checkout"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
