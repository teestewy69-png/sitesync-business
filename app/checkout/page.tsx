"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import ShopHeader from "@/components/shop/ShopHeader";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney, parsePrice } from "@/data/products";

type Status = "idle" | "submitting" | "done";

export default function CheckoutPage() {
  const { lines, subtotal, clear, getLineProduct } = useCart();
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const detailed = useMemo(
    () =>
      lines
        .map((line) => {
          const product = getLineProduct(line.slug);
          if (!product || product.contactOnly) return null;
          return { ...line, product };
        })
        .filter(Boolean) as {
        slug: string;
        quantity: number;
        product: NonNullable<ReturnType<typeof getLineProduct>>;
      }[],
    [lines, getLineProduct]
  );

  const singleStripe =
    detailed.length === 1 &&
    detailed[0].quantity === 1 &&
    detailed[0].product.stripeUrl
      ? detailed[0].product.stripeUrl
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (detailed.length === 0) return;

    if (singleStripe) {
      window.location.href = singleStripe;
      return;
    }

    setStatus("submitting");
    await new Promise((r) => window.setTimeout(r, 600));
    clear();
    setStatus("done");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <ShopHeader />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-2 text-sm text-slate-400">
          {singleStripe
            ? "One Stripe-ready item — continue to secure payment."
            : "Enter your details. Multi-item and affiliate orders are confirmed by email while checkout expands."}
        </p>

        {status === "done" ? (
          <div className="mt-10 space-y-4 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-8 text-center">
            <h2 className="text-xl font-semibold text-white">Order received</h2>
            <p className="text-sm text-slate-300">
              Thanks{name ? `, ${name}` : ""}. We&apos;ll follow up at{" "}
              <span className="text-brand-300">{email}</span> from{" "}
              <a
                href="mailto:save@sitesinc.co"
                className="text-brand-300 hover:underline"
              >
                save@sitesinc.co
              </a>
              .
            </p>
            <Link
              href="/shop"
              className="inline-flex rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow"
            >
              Back to shop
            </Link>
          </div>
        ) : detailed.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-slate-300">Nothing to check out yet.</p>
            <Link
              href="/shop"
              className="mt-4 inline-flex text-sm text-brand-300 hover:underline"
            >
              Browse shop →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
              {detailed.map(({ product, quantity }) => (
                <div
                  key={product.slug}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <p className="text-slate-200">
                    {product.name}{" "}
                    <span className="text-slate-500">× {quantity}</span>
                  </p>
                  <p className="font-medium text-white">
                    {formatMoney(parsePrice(product.price) * quantity)}
                  </p>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-3">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-lg font-semibold text-white">
                  {formatMoney(subtotal)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">
                  Full name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/70 focus:ring-2 focus:ring-brand-400/30"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/70 focus:ring-2 focus:ring-brand-400/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:opacity-60 sm:w-auto"
            >
              {status === "submitting"
                ? "Working…"
                : singleStripe
                  ? "Continue to Stripe"
                  : "Place order"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
