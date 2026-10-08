/**
 * Stripe webhook event processing (after signature verification). Idempotent per event id
 * (lib/siteflow/state.ts claimEvent) and per Stripe object (ledger / commission ids derive from it).
 */
import type { StripeCheckoutSession } from "@/lib/stripe-checkout";
import { findOrderById, type Order } from "@/lib/store";
import {
  markOrderPaidFromSession,
  markOrderPaymentFailed,
  markSubscriptionCanceled,
  recordInvoicePayment,
  recordRefund,
} from "./orders";
import { safeError } from "./sanitize";
import { claimEvent, finishEvent, getIndex, recordWebhookSeen } from "./state";

export type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  created?: number;
  data: { object: Record<string, unknown> };
};

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "charge.refunded",
  "customer.subscription.deleted",
] as const;

export type ProcessDeps = {
  /** Called once when an order first becomes paid (fulfillment + owner notice run after the response). */
  onPaid: (orderId: string) => void;
  /** Called when a subscription ends (owner notice). */
  onSubscriptionCanceled?: (orderId: string) => void;
};

export type ProcessResult = {
  status: "processed" | "duplicate" | "in_progress" | "ignored" | "error";
  note: string;
  orderId?: string;
};

function str(v: unknown): string | undefined {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return undefined;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function meta(v: unknown): Record<string, string> {
  return v && typeof v === "object" ? (v as Record<string, string>) : {};
}

async function orderFrom(candidates: Array<string | undefined>, indexes: Array<[Parameters<typeof getIndex>[0], string | undefined]>): Promise<Order | null> {
  for (const id of candidates) {
    if (!id) continue;
    const order = await findOrderById(id);
    if (order) return order;
  }
  for (const [kind, stripeId] of indexes) {
    if (!stripeId) continue;
    const id = await getIndex(kind, stripeId);
    const order = id ? await findOrderById(id) : null;
    if (order) return order;
  }
  return null;
}

async function handle(event: StripeEvent, deps: ProcessDeps): Promise<ProcessResult> {
  const obj = event.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed": {
      const session = obj as unknown as StripeCheckoutSession;
      const m = meta(session.metadata);
      const order = await orderFrom([m.orderId, session.client_reference_id || undefined], [["session", session.id]]);
      if (!order) return { status: "ignored", note: "No SiteFlow order for this session (not created by this site/store)." };
      if (event.type === "checkout.session.async_payment_failed") {
        await markOrderPaymentFailed(order);
        return { status: "processed", note: "Async payment failed; order marked failed.", orderId: order.id };
      }
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        const { newlyPaid } = await markOrderPaidFromSession(order, session);
        if (newlyPaid) deps.onPaid(order.id);
        return { status: "processed", note: newlyPaid ? "Order paid." : "Order already paid.", orderId: order.id };
      }
      return { status: "processed", note: "Session complete but payment still pending (async method).", orderId: order.id };
    }
    case "invoice.paid": {
      const parent = (obj.parent as Record<string, unknown> | undefined) || {};
      const subDetails =
        (parent.subscription_details as Record<string, unknown> | undefined) ||
        (obj.subscription_details as Record<string, unknown> | undefined) ||
        {};
      const subscriptionId = str(obj.subscription) || str(subDetails.subscription);
      const m = meta(subDetails.metadata);
      const order = await orderFrom([m.orderId], [["sub", subscriptionId], ["customer", str(obj.customer)]]);
      if (!order) return { status: "ignored", note: "Invoice is not linked to a SiteFlow order." };
      const taxes = Array.isArray(obj.total_taxes)
        ? (obj.total_taxes as Array<{ amount?: number }>).reduce((s, t) => s + num(t.amount), 0)
        : num(obj.tax);
      const { newlyPaid } = await recordInvoicePayment(order, {
        id: String(obj.id),
        amountPaidCents: num(obj.amount_paid),
        taxCents: taxes,
        currency: String(obj.currency || "usd"),
        livemode: event.livemode,
        paymentIntentId: str(obj.payment_intent),
        subscriptionId,
        customerId: str(obj.customer),
        customerEmail: typeof obj.customer_email === "string" ? obj.customer_email : null,
      });
      if (newlyPaid) deps.onPaid(order.id);
      return { status: "processed", note: "Invoice payment recorded.", orderId: order.id };
    }
    case "charge.refunded": {
      const m = meta(obj.metadata);
      const pi = str(obj.payment_intent);
      const order = await orderFrom([m.orderId], [["pi", pi], ["customer", str(obj.customer)]]);
      if (!order) return { status: "ignored", note: "Refunded charge is not linked to a SiteFlow order." };
      await recordRefund(order, {
        id: String(obj.id),
        amountRefundedCents: num(obj.amount_refunded),
        currency: String(obj.currency || "usd"),
        livemode: event.livemode,
        paymentIntentId: pi,
      });
      return { status: "processed", note: "Refund recorded.", orderId: order.id };
    }
    case "customer.subscription.deleted": {
      const m = meta(obj.metadata);
      const order = await orderFrom([m.orderId], [["sub", str(obj.id)]]);
      if (!order) return { status: "ignored", note: "Subscription is not linked to a SiteFlow order." };
      const before = order.subscriptionStatus;
      await markSubscriptionCanceled(order);
      if (before !== "canceled") deps.onSubscriptionCanceled?.(order.id);
      return { status: "processed", note: "Subscription canceled.", orderId: order.id };
    }
    default:
      return { status: "ignored", note: `Event type ${event.type} is not handled.` };
  }
}

/**
 * Process a verified event exactly once. Throws only when processing failed and Stripe should retry
 * (the route answers 500); the event record is marked failed so the retry is allowed through.
 */
export async function processStripeEvent(event: StripeEvent, deps: ProcessDeps): Promise<ProcessResult> {
  if (!event || typeof event.id !== "string" || typeof event.type !== "string") {
    return { status: "ignored", note: "Not a Stripe event." };
  }
  await recordWebhookSeen({
    at: new Date().toISOString(),
    type: event.type,
    eventId: event.id,
    livemode: Boolean(event.livemode),
    verified: true,
  }).catch(() => undefined);

  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
    return { status: "ignored", note: `Event type ${event.type} is not handled.` };
  }
  const claim = await claimEvent(event.id, event.type, event.livemode);
  if (claim === "duplicate") return { status: "duplicate", note: "Event already processed." };
  if (claim === "in_progress") return { status: "in_progress", note: "Event is being processed by another delivery." };
  try {
    const result = await handle(event, deps);
    await finishEvent(event.id, true);
    return result;
  } catch (err) {
    const message = safeError(err, "Webhook processing failed");
    await finishEvent(event.id, false, message).catch(() => undefined);
    throw new Error(message);
  }
}
