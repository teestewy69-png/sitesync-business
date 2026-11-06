import PaymentOptions from "@/components/PaymentOptions";

/** Public $1,995 Payment Links checkout. Used when SiteFlow product checkout is paused. */
export default function PublicBuildCheckout() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Checkout</h1>
      <p className="mt-3 text-base text-slate-300">
        Pay the advertised $1,995 website build: $997.50 to start and $997.50 at launch, or $1,995
        in one payment. Optional monitored SEO is $129/mo.
      </p>
      <PaymentOptions location="checkout" showHeading={false} />
    </section>
  );
}
