import Link from "next/link";

export default function CartPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Cart
      </h1>
      <p className="mt-3 text-base text-slate-300">
        Sample cart view for ecommerce and affiliate-ready storefront layouts.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  Website Design Digital Product Bundle
                </p>
                <p className="mt-1 text-sm text-slate-400">Quantity: 1</p>
              </div>
              <p className="text-lg font-semibold text-slate-50">$24.99</p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-50">
                  Mack Makeup Bundle
                </p>
                <p className="mt-1 text-sm text-slate-400">Quantity: 1</p>
              </div>
              <p className="text-lg font-semibold text-slate-50">$75.00</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-slate-50">
            Order Summary
          </h2>
          <div className="mt-4 space-y-2 text-base text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>$99.99</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated Tax</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3 font-semibold text-slate-50">
              <span>Total</span>
              <span>$99.99</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </section>
  );
}
