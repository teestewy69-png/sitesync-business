"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/siteflow/CartProvider";
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
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    // Read once on mount (useSearchParams would force a Suspense boundary on this page).
    if (new URLSearchParams(window.location.search).get("canceled") === "1") {
      const timer = window.setTimeout(() => setCanceled(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

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
  // Only physical goods need a postal address; digital and service carts never ask for one.
  const needsAddress = items.some(({ product }) => product.requiresShipping);
  const inputProducts = items.filter(({ product }) => product.fulfillmentInputs?.length);


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
          ...(needsAddress ? { address, city, zip } : {}),
          lines: lines.map((line) => ({
            slug: line.slug,
            quantity: line.quantity,
            ...(inputs[line.slug] ? { inputs: inputs[line.slug] } : {}),
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
      const next = data.checkoutUrl || data.redirect || "/thank-you";
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
          Nothing to check out yet.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
        >
          Back to Sitesinc
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
        Enter your details, then continue to Stripe&apos;s secure payment page.
        Prices come from our catalog on the server.
      </p>
      {canceled ? (
        <p role="status" className="mt-3 text-sm text-amber-200">
          Payment was canceled, so nothing was charged. Your cart is still here.
        </p>
      ) : null}
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
          {needsAddress ? (
            <>
            <div>
              <label className="block text-sm font-medium text-slate-200">
                Shipping Address
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
            </>
          ) : null}
          {inputProducts.map(({ product }) => (
            <fieldset key={product.slug} className="space-y-3 rounded-2xl border border-white/10 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-100">{product.name}: details we need</legend>
              {product.fulfillmentInputs!.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`${product.slug}-${field.key}`} className="block text-sm font-medium text-slate-200">
                    {field.label}
                  </label>
                  <input
                    id={`${product.slug}-${field.key}`}
                    type={field.kind === "url" ? "url" : "text"}
                    required={field.required}
                    maxLength={field.maxLength}
                    value={inputs[product.slug]?.[field.key] ?? ""}
                    onChange={(event) =>
                      setInputs((prev) => ({
                        ...prev,
                        [product.slug]: { ...(prev[product.slug] || {}), [field.key]: event.target.value },
                      }))
                    }
                    placeholder={field.placeholder}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
                  />
                </div>
              ))}
            </fieldset>
          ))}
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
            {status === "loading" ? "Placing order..." : "Continue to payment"}
          </button>
          {status === "error" ? (
            <p className="mt-3 text-sm text-red-400">{errorMessage}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              Card details are entered on Stripe, never on this site. Promotion
              codes can be applied on the Stripe page. If online payment is
              unavailable, we save the order and email you a payment link.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
