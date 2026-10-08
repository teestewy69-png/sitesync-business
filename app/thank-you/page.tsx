import Link from "next/link";
import content from "@/content.json";
import { runAfterResponse } from "@/lib/siteflow/after";
import { siteflowEnabled } from "@/lib/siteflow/flag";
import { downloadUrl, fulfillOrder } from "@/lib/siteflow/fulfillment";
import { isPaidState, markOrderPaidFromSession } from "@/lib/siteflow/orders";
import { isStripeConfigured, retrieveCheckoutSession } from "@/lib/stripe-checkout";
import { findOrderById, type Order } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thank you | Sitesinc", robots: { index: false, follow: false } };

type RequestKey = "launch" | "full" | "maintenance";

const REQUEST_COPY: Record<RequestKey, { title: string; body: string }> = {
  launch: {
    title: "Thanks — we received your request",
    body: "Submitting a Sitesinc form is a request, not a purchase. If we accept the project, you will receive a $997.50 start invoice by email. The remaining $997.50 is due at launch.",
  },
  full: {
    title: "Thanks — we received your request",
    body: "This is not a website checkout. If we accept the project, Sitesinc sends the $997.50 start invoice manually.",
  },
  maintenance: {
    title: "Thanks — monitoring request received",
    body: "Optional monitoring is $129/month and can be enrolled manually after a website is accepted. Cancel anytime. No long-term contract.",
  },
};

type OrderView = {
  state: "paid" | "pending" | "not_completed" | "recorded" | "refunded" | "failed" | "delivery_problem" | "not_found";
  title: string;
  body: string;
  links: { name: string; url: string }[];
  manual: string[];
  preparing: boolean;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}

function resolveRequest(value: string): RequestKey {
  return value === "full" || value === "maintenance" ? value : "launch";
}

function viewFromStatus(order: Order, verifiedSession: boolean): OrderView {
  const base = { links: [], manual: [], preparing: false };
  switch (order.status) {
    case "paid":
    case "fulfilled": {
      const deliveries = order.fulfillment?.deliveries || [];
      const links = verifiedSession
        ? deliveries
            .map((d) => {
              const url = downloadUrl(order, d);
              const name = order.items.find((i) => i.slug === d.slug)?.name || d.slug;
              return url ? { name, url } : null;
            })
            .filter((x): x is { name: string; url: string } => Boolean(x))
        : [];
      const manual = deliveries
        .filter((d) => d.state === "manual")
        .map((d) => order.items.find((i) => i.slug === d.slug)?.name || d.slug);
      const preparing = !order.fulfillment || ["pending", "running"].includes(order.fulfillment.state);
      return {
        ...base,
        state: "paid",
        title: "Payment confirmed",
        body: preparing
          ? "Stripe confirmed your payment. We're preparing your order now and will email it to you in a few minutes."
          : order.fulfillment?.emailedAt
            ? "Stripe confirmed your payment and we've emailed your order details."
            : "Stripe confirmed your payment. We'll email your order details shortly.",
        links,
        manual,
        preparing,
      };
    }
    case "awaiting_stripe":
      return {
        ...base,
        state: "pending",
        title: "Payment not confirmed yet",
        body: "We haven't received a payment confirmation from Stripe for this order. If you completed payment, it may still be processing; you'll get an email when it clears. Nothing is delivered until it does.",
      };
    case "recorded":
    case "email_only":
      return {
        ...base,
        state: "recorded",
        title: "Order recorded — no payment taken",
        body: "We saved your order, but no payment was collected online. We'll email you a payment link; your order is delivered after payment.",
      };
    case "refunded":
      return { ...base, state: "refunded", title: "Order refunded", body: "This order was refunded in full." };
    case "failed":
      return order.paidAt
        ? {
            ...base,
            state: "delivery_problem",
            title: "Payment confirmed — delivery delayed",
            body: "Your payment went through, but preparing your order hit a problem. We've been alerted and will email it to you as soon as it's fixed.",
          }
        : { ...base, state: "failed", title: "Payment failed", body: "The payment did not go through, so nothing was charged. You can try checkout again." };
  }
}

async function orderView(orderId: string, sessionId: string): Promise<OrderView> {
  let order: Order | null = null;
  try {
    order = await findOrderById(orderId);
  } catch {
    order = null;
  }
  if (!order) {
    return {
      state: "not_found",
      title: "We couldn't find that order",
      body: "This link doesn't match an order we have on file. If you paid, check your email for a receipt from Stripe, or contact us.",
      links: [],
      manual: [],
      preparing: false,
    };
  }

  let verified = false;
  if (sessionId && isStripeConfigured()) {
    try {
      const session = await retrieveCheckoutSession(sessionId);
      const matches = session.client_reference_id === order.id || session.metadata?.orderId === order.id;
      if (matches) {
        verified = true;
        if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
          // Server-side confirmation straight from Stripe; same idempotent transition the webhook uses.
          const result = await markOrderPaidFromSession(order, session);
          order = result.order;
          if (result.newlyPaid) runAfterResponse(`fulfill ${order.id}`, () => fulfillOrder(order!.id));
        } else if (!isPaidState(order.status)) {
          if (session.status === "open") {
            return {
              state: "not_completed",
              title: "Payment not completed",
              body: "Checkout was not finished, so nothing was charged.",
              links: [],
              manual: [],
              preparing: false,
            };
          }
          if (session.status === "expired") {
            return {
              state: "not_completed",
              title: "Checkout expired",
              body: "This checkout expired before payment, so nothing was charged.",
              links: [],
              manual: [],
              preparing: false,
            };
          }
          return {
            state: "pending",
            title: "Payment processing",
            body: "Your payment method is still processing. We'll email you when Stripe confirms it; nothing is delivered until then.",
            links: [],
            manual: [],
            preparing: false,
          };
        }
      }
    } catch (err) {
      console.warn("Thank-you session check failed:", err instanceof Error ? err.name : "unknown");
    }
  }
  return viewFromStatus(order, verified);
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[]; order?: string | string[]; session_id?: string | string[] }>;
}) {
  const params = await searchParams;
  const email = content.footer.email;
  // Order/payment states belong to SiteFlow product checkout. While it is paused (Path A) this page only
  // confirms build/monitoring requests and never talks about payments, orders or deliveries.
  const commerce = siteflowEnabled();
  const orderId = commerce ? first(params.order).slice(0, 80) : "";
  const sessionId = commerce ? first(params.session_id).slice(0, 200) : "";
  const view = orderId ? await orderView(orderId, sessionId) : null;
  const copy = view || REQUEST_COPY[resolveRequest(first(params.product))];

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-base text-slate-300">
          {copy.body} We&apos;ll reach you from{" "}
          <span className="font-semibold text-brand-300">{email}</span>.
        </p>
        {view?.links.length ? (
          <ul className="space-y-2">
            {view.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  className="inline-flex items-center justify-center rounded-full border border-brand-300/50 px-5 py-2 text-sm font-semibold text-brand-200 hover:bg-brand-500/10"
                >
                  Download {link.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {view?.manual.length ? (
          <p className="text-sm text-slate-400">
            We&apos;ll set up {view.manual.join(", ")} by hand and email you within one business day.
          </p>
        ) : null}
        {orderId ? (
          <p className="text-sm text-slate-400">
            Order ID: <span className="font-mono text-slate-200">{orderId}</span>
          </p>
        ) : null}
        {view?.state === "not_completed" || view?.state === "failed" ? (
          <Link href="/checkout" className="text-sm text-brand-300 hover:underline">
            Return to checkout
          </Link>
        ) : null}
        <p className="text-sm text-slate-400">
          If you don&apos;t see our email, check your spam folder or contact us
          directly at{" "}
          <a
            href={`mailto:${email}`}
            className="text-brand-300 hover:underline"
          >
            {email}
          </a>
          .
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
        >
          Back to Sitesinc
        </Link>
      </div>
    </main>
  );
}
