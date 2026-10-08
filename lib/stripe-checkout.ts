import type { Order } from "@/lib/store";
import { pricesByLookupKey, stripeApi, stripeSecretKey, type FormValue, type StripePrice } from "@/lib/siteflow/stripe";

export function isStripeConfigured(): boolean {
  return Boolean(stripeSecretKey());
}

export type CheckoutSessionRef = { id: string; url: string };

/** Literal placeholder Stripe replaces with the real session id on redirect. Must not be URL-encoded. */
export const SESSION_ID_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

export function successUrl(origin: string, orderId: string): string {
  return `${origin}/thank-you?order=${encodeURIComponent(orderId)}&session_id=${SESSION_ID_PLACEHOLDER}`;
}

/**
 * A synced Stripe price is used only when it matches the catalog exactly (amount, currency, recurring
 * interval). Otherwise the line falls back to inline price_data with the catalog amount, so a stale
 * Stripe price can never charge a different amount than the site shows.
 */
export function matchingPriceId(item: Order["items"][number], price: StripePrice | undefined): string | null {
  if (!price || !price.active) return null;
  if (price.currency !== "usd") return null;
  if (price.unit_amount !== (item.unitAmountCents ?? Math.round(item.unitAmount * 100))) return null;
  const wantInterval = item.kind === "subscription" ? item.interval || "month" : null;
  const haveInterval = price.recurring?.interval || null;
  return wantInterval === haveInterval ? price.id : null;
}

/** Pure: the exact form parameters sent to POST /v1/checkout/sessions (unit-tested). */
export function buildCheckoutParams(opts: {
  order: Order;
  origin: string;
  prices?: Map<string, StripePrice>;
}): Record<string, FormValue> {
  const { order, origin } = opts;
  const mode = order.mode || (order.items.some((i) => i.kind === "subscription") ? "subscription" : "payment");
  const metadata: Record<string, string> = { orderId: order.id, siteflow: "1" };
  if (order.ref) metadata.ref = order.ref;

  const lineItems = order.items.map((item) => {
    const priceId = item.stripeLookupKey ? matchingPriceId(item, opts.prices?.get(item.stripeLookupKey)) : null;
    if (priceId) return { price: priceId, quantity: item.quantity };
    const cents = item.unitAmountCents ?? Math.round(item.unitAmount * 100);
    return {
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: cents,
        product_data: { name: item.name, metadata: { slug: item.slug } },
        ...(item.kind === "subscription" ? { recurring: { interval: item.interval || "month" } } : {}),
      },
    };
  });

  const params: Record<string, FormValue> = {
    mode,
    success_url: successUrl(origin, order.id),
    cancel_url: `${origin}/checkout?canceled=1`,
    customer_email: order.email,
    client_reference_id: order.id,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata,
    line_items: lineItems,
  };
  // Postal address only for physical goods. Digital/service carts never ask for one.
  if (order.requiresShipping) {
    params.shipping_address_collection = { allowed_countries: ["US"] };
  }
  if (mode === "subscription") {
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = { metadata };
    params.customer_creation = "always";
  }
  return params;
}

export async function createStripeCheckoutSession(opts: { order: Order; origin: string }): Promise<CheckoutSessionRef> {
  if (!isStripeConfigured()) throw new Error("Stripe is not configured.");
  const keys = opts.order.items.map((i) => i.stripeLookupKey || "").filter(Boolean);
  let prices = new Map<string, StripePrice>();
  try {
    prices = await pricesByLookupKey(keys);
  } catch (err) {
    // Price lookup is an optimisation; inline catalog prices still charge the right amount.
    console.warn("Stripe price lookup failed; using catalog prices:", err instanceof Error ? err.name : "unknown");
  }
  const session = await stripeApi<{ id: string; url: string | null }>(
    "POST",
    "/v1/checkout/sessions",
    buildCheckoutParams({ ...opts, prices }),
    { idempotencyKey: `siteflow-checkout-${opts.order.id}` }
  );
  if (!session.url) throw new Error("Stripe checkout could not be created.");
  return { id: session.id, url: session.url };
}

/** Back-compat wrapper. */
export async function createStripeCheckoutUrl(opts: { order: Order; origin: string }): Promise<string> {
  return (await createStripeCheckoutSession(opts)).url;
}

export type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  mode: "payment" | "subscription" | "setup";
  status: "open" | "complete" | "expired" | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  customer: string | null;
  customer_email: string | null;
  customer_details: { email: string | null } | null;
  payment_intent: string | null;
  subscription: string | null;
  amount_total: number | null;
  amount_subtotal: number | null;
  currency: string | null;
  total_details: { amount_tax?: number; amount_shipping?: number; amount_discount?: number } | null;
  livemode: boolean;
};

export async function retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Not a Checkout Session id.");
  return stripeApi<StripeCheckoutSession>("GET", `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
