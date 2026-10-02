"use client";

import { FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/data/products";
import { useCart } from "@/components/shop/CartProvider";

type Status = "idle" | "loading" | "success" | "error";

const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function ProductActions({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fieldId = useId();
  // One key per form instance; cleared when the visitor edits a field so changed content is a new submission.
  const idempotencyKey = useRef("");
  const submitting = useRef(false);
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

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      if (!submitting.current) idempotencyKey.current = "";
      setter(value);
    };
  }

  async function handleInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Ignore re-submits while a request is in flight and after it succeeded.
    if (submitting.current || status === "success") return;
    submitting.current = true;
    if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          slug: product.slug,
          name,
          email,
          message,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Could not send inquiry.");
      }
      setStatus("success");
      // submitting stays true after success so the form cannot be sent twice.
    } catch (err) {
      submitting.current = false;
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
        aria-busy={status === "loading"}
        className="space-y-3 rounded-2xl border border-brand-400/30 bg-brand-500/10 p-5"
      >
        <p className="text-sm font-semibold text-brand-200">Request a quote</p>
        <p className="text-base text-slate-400">
          This offer is inquiry-only. Send a note and we&apos;ll reply from
          save@sitesinc.co.
        </p>
        {status === "success" ? (
          <p role="status" className="text-sm font-medium text-brand-200">
            Inquiry sent. Check your inbox for a confirmation.
          </p>
        ) : (
          <>
            <label htmlFor={`${fieldId}-name`} className="sr-only">
              Your name
            </label>
            <input
              id={`${fieldId}-name`}
              name="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => edit(setName)(event.target.value)}
              placeholder="Your name"
              className={FIELD_CLASS}
            />
            <label htmlFor={`${fieldId}-email`} className="sr-only">
              Email address
            </label>
            <input
              id={`${fieldId}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => edit(setEmail)(event.target.value)}
              placeholder="you@email.com"
              className={FIELD_CLASS}
            />
            <label htmlFor={`${fieldId}-message`} className="sr-only">
              Your message
            </label>
            <textarea
              id={`${fieldId}-message`}
              name="message"
              required
              rows={4}
              value={message}
              onChange={(event) => edit(setMessage)(event.target.value)}
              className={FIELD_CLASS}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:opacity-60"
            >
              {status === "loading" ? "Sending..." : "Send inquiry"}
            </button>
            {status === "error" ? (
              <p role="alert" className="text-sm text-red-400">
                {errorMessage}
              </p>
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
