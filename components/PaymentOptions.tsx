import Link from "next/link";
import {
  DEFAULT_PAYMENT_KEYS,
  paymentLinks,
  type PaymentLinkKey,
} from "@/lib/payment-links";

const primaryClass =
  "inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3.5 text-center font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500";
const secondaryClass =
  "inline-flex w-full items-center justify-center rounded-xl bg-white/5 px-6 py-3 text-center font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10";

export default function PaymentOptions({
  location,
  keys = DEFAULT_PAYMENT_KEYS,
  heading = "Pay for your website build",
  showHeading = true,
}: {
  location: string;
  keys?: PaymentLinkKey[];
  heading?: string;
  showHeading?: boolean;
}) {
  const catalog = paymentLinks();
  const links = keys.map((key) => catalog[key]);

  return (
    <section id="pay" className="mt-8">
      {showHeading ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">{heading}</h2>
          <p className="mt-2 text-base text-slate-400">
            Website builds are $1,995. Pay $997.50 to start and $997.50 at launch, or pay $1,995
            in one payment. Card details stay on the payment page, not on this site.
          </p>
        </div>
      ) : null}
      <div className={`grid gap-4 ${links.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {links.map((link) => (
          <article
            key={link.key}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <p className="text-sm font-medium uppercase tracking-wider text-brand-300">{link.title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{link.amount}</p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{link.description}</p>
            <a
              href={link.url}
              data-analytics-cta={link.analytics}
              data-analytics-location={location}
              className={`mt-5 ${link.primary ? primaryClass : secondaryClass}`}
            >
              {link.cta}
            </a>
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-400">
        Questions first?{" "}
        <Link href="/contact#contact-form" className="text-brand-300 hover:underline">
          Send a request
        </Link>{" "}
        — that form is not a purchase.
      </p>
    </section>
  );
}
