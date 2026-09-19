"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney } from "@/data/products";

type Status = "idle" | "loading" | "error";

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, subtotal, clear, getLineProduct } = useCart();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          address,
          city,
          zip,
          lines: lines.map((line) => ({
            slug: line.slug,
            quantity: line.quantity,
          })),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; redirect?: string; checkoutUrl?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Checkout failed. Please try again.");
      }
      clear();
      const next = data.checkoutUrl || data.redirect || "/thank-you?product=ebook";
      if (next.startsWith("http")) {
        window.location.assign(next);
        return;
      }
      router.push(next);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Checkout failed. Please try again."
      );
    }
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-3 text-base text-slate-300">
          Nothing to check out yet. Add a product from the shop first.
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
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Checkout
      </h1>
      <p className="mt-3 text-base text-slate-300">
        Place the order. We&apos;ll email save@sitesinc.co and you. If Stripe
        is configured, you&apos;ll continue to a secure payment page.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
              placeholder="John Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Billing Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-200">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200">
                ZIP / Postal Code
              </label>
              <input
                type="text"
                value={zip}
                onChange={(event) => setZip(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
                placeholder="ZIP Code"
              />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-slate-50">Order Summary</h2>
          <div className="mt-4 space-y-3 text-base text-slate-300">
            {items.map(({ line, product }) => (
              <div key={line.slug} className="flex justify-between gap-3">
                <span>
                  {product.name} × {line.quantity}
                </span>
                <span>{product.price}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-white/10 pt-3 font-semibold text-slate-50">
              <span>Total</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Placing order..." : "Complete checkout"}
          </button>
          {status === "error" ? (
            <p className="mt-3 text-sm text-red-400">{errorMessage}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Prices come from the catalog on the server. Card collection uses
              Stripe Checkout when a secret key is set; otherwise we email the
              order and follow up with a payment link.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
