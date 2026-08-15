export default function CheckoutPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Checkout
      </h1>
      <p className="mt-3 text-sm text-slate-300">
        Sample checkout page for product sales, affiliate-ready offers, and
        digital product transactions.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Email Address
            </label>
            <input
              type="email"
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
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-brand-400/60"
                placeholder="ZIP Code"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Card Details
            </label>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-400">
              Secure Stripe payment element placeholder
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-slate-50">
            Order Summary
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Website Design Digital Product Bundle</span>
              <span>$24.99</span>
            </div>
            <div className="flex justify-between">
              <span>Mack Makeup Bundle</span>
              <span>$75.00</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3 font-semibold text-slate-50">
              <span>Total</span>
              <span>$99.99</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            Complete Secure Checkout
          </button>
          <p className="mt-3 text-[11px] text-slate-400">
            Powered by Stripe • Secure checkout demo for submission and
            storefront preview
          </p>
        </div>
      </div>
    </section>
  );
}
