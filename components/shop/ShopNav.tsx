"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import content from "@/content.json";
import { useCart } from "@/components/shop/CartProvider";

function linkClass(active: boolean) {
  return [
    "relative text-sm font-medium transition",
    active
      ? "text-brand-200"
      : "text-slate-300 hover:text-brand-200",
  ].join(" ");
}

export default function ShopNav() {
  const { site } = content;
  const { itemCount } = useCart();
  const pathname = usePathname();

  const onShop =
    pathname === "/shop" || pathname.startsWith("/shop/");
  const onCart = pathname === "/cart";
  const onCheckout = pathname === "/checkout";

  return (
    <header className="sticky top-11 z-50 border-b border-brand-500/15 bg-black/85 backdrop-blur-md sm:top-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent"
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-2.5 sm:gap-3"
          aria-label={`${site.name} home`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            className="h-14 w-auto shrink-0 rounded-lg ring-1 ring-white/10 transition group-hover:ring-brand-400/40 sm:h-16"
          />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold tracking-tight text-white sm:text-[15px]">
              {site.name}
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.16em] text-brand-400/90 sm:block">
              Business
            </span>
          </span>
        </Link>

        <nav
          className="flex items-center gap-1 sm:gap-2"
          aria-label="Shop"
        >
          <Link
            href="/shop"
            className={`${linkClass(onShop)} rounded-lg px-2.5 py-2 sm:px-3`}
            aria-current={onShop ? "page" : undefined}
          >
            Shop
            {onShop ? (
              <span
                aria-hidden
                className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-brand-400 sm:inset-x-3"
              />
            ) : null}
          </Link>

          <Link
            href="/cart"
            className={`${linkClass(onCart)} inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 sm:px-3`}
            aria-current={onCart ? "page" : undefined}
          >
            <ShoppingBag
              className="h-4 w-4 shrink-0 opacity-80"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-1.5 text-xs font-semibold text-zinc-950 shadow-glow">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            ) : null}
            {onCart ? (
              <span
                aria-hidden
                className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-brand-400 sm:inset-x-3"
              />
            ) : null}
          </Link>

          <Link
            href="/checkout"
            className={[
              "ml-0.5 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:ml-1 sm:px-4",
              onCheckout
                ? "bg-gradient-to-b from-brand-200 to-brand-500 text-zinc-950 shadow-glow ring-1 ring-brand-200/50"
                : "bg-gradient-to-b from-brand-300 to-brand-600 text-zinc-950 shadow-glow hover:from-brand-200 hover:to-brand-500",
            ].join(" ")}
            aria-current={onCheckout ? "page" : undefined}
          >
            Checkout
          </Link>
        </nav>
      </div>
    </header>
  );
}
