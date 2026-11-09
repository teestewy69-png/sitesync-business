"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/siteflow/CartProvider";

/**
 * Storefront add-to-cart: puts one unit of a public catalog product into the shared
 * CartProvider cart (localStorage-backed, same cart /cart and /checkout read).
 * CartProvider.addItem re-validates the slug against the public catalog, so an
 * unlisted or contact-only product can never be added from here.
 */
export default function AddToCartButton({ slug }: { slug: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <p className="text-sm text-slate-300" role="status">
        Added to your cart.{" "}
        <Link href="/cart" className="font-semibold text-brand-300 hover:underline">
          View cart
        </Link>{" "}
        or{" "}
        <Link href="/checkout" className="font-semibold text-brand-300 hover:underline">
          go to checkout
        </Link>
        .
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        addItem(slug);
        setAdded(true);
      }}
      className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
    >
      Add to cart
    </button>
  );
}
