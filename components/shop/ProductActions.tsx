"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/data/products";
import { useCart } from "@/components/shop/CartProvider";

type Status = "idle" | "loading" | "success" | "error";

export default function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(
    `I'd like pricing and availability for ${product.name}.`
  );

  function handleAdd() {
    addItem(product.slug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow() {
    addItem(product.slug);
    router.push("/checkout");
  }

  async function handleInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: product.slug,
          name,
          email,
          message,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Could not send inquiry.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Could not send inquiry."
      );
    }
  }

  if (product.contactOnly) {
    return (
      <form
        onSubmit={handleInquiry}
        className="space-y-3 rounded-2xl border border-brand-400/30 bg-brand-500/10 p-5"
      >
        <p className="text-sm font-semibold text-brand-200">Request a quote</p>
        <p className="text-base text-slate-400">
          This offer is inquiry-only. Send a note and we&apos;ll reply from
          save@sitesinc.co.
        </p>
        {status === "success" ? (
          <p className="text-sm font-medium text-brand-200">
            Inquiry sent. Check your inbox for a confirmation.
          </p>
        ) : (
          <>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
            />
            <textarea
              required
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:opacity-60"
            >
              {status === "loading" ? "Sending..." : "Send inquiry"}
            </button>
            {status === "error" ? (
              <p className="text-sm text-red-400">{errorMessage}</p>
            ) : null}
          </>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-1 sm:flex-row">
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
      >
        {added ? "Added ✓" : "Add to cart"}
      </button>
      <button
        type="button"
        onClick={handleBuyNow}
        className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 transition hover:border-brand-400/50"
      >
        Buy now
      </button>
    </div>
  );
}
