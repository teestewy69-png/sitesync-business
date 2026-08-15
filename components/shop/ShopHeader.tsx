"use client";

import Link from "next/link";
import content from "@/content.json";
import { useCart } from "@/components/shop/CartProvider";

export default function ShopHeader() {
  const { site } = content;
  const { itemCount } = useCart();

  return (
    <header className="border-b border-white/5 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={`${site.name} logo`}
            className="h-10 w-auto rounded-lg ring-1 ring-white/10"
          />
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-300">
          <Link href="/shop" className="transition hover:text-brand-300">
            Shop
          </Link>
          <Link href="/cart" className="transition hover:text-brand-300">
            Cart
            {itemCount > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-zinc-950">
                {itemCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/checkout"
            className="rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            Checkout
          </Link>
        </nav>
      </div>
    </header>
  );
}
