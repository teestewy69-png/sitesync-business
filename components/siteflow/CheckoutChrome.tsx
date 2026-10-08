import type { ReactNode } from "react";
import Link from "next/link";
import { CartProvider } from "@/components/siteflow/CartProvider";

/**
 * Paused SiteFlow (phase 2): chrome for /cart and /checkout only. Those routes 404 unless SITEFLOW_ENABLED is set.
 * The old public shop (/shop, product pages, inquiry form, shop nav) was removed on 2026-10-05; Sitesinc sells
 * website builds and optional monitoring only. Future digital products will need their own product pages.
 */
export default function CheckoutChrome({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-white/10 bg-black/85">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link href="/" className="text-sm font-semibold text-white">
              Sitesinc
            </Link>
            <nav className="flex items-center gap-3 text-sm text-slate-300" aria-label="Checkout">
              <Link href="/cart" className="hover:text-brand-200">
                Cart
              </Link>
              <Link href="/checkout" className="hover:text-brand-200">
                Checkout
              </Link>
            </nav>
          </div>
        </header>
        <main id="main-content">{children}</main>
      </div>
    </CartProvider>
  );
}
