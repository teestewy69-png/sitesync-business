/**
 * Order state transitions shared by the Stripe webhook and the server-side thank-you confirmation.
 * Every function is idempotent: replaying the same Stripe object leaves the same result.
 */
import { findOrderById, updateOrder, type Order } from "@/lib/store";
import {
  applyRefundToCommission,
  commissionBase,
  earnsOnPayment,
  newCommission,
  refundWindowDays,
} from "./commission-math";
import { isSelfReferral } from "./ref";
import {
  createCommissionOnce,
  getPartner,
  listCommissions,
  listRevenue,
  putCommission,
  putRevenue,
  setIndex,
} from "./state";
import type { StripeCheckoutSession } from "@/lib/stripe-checkout";

const PAID_STATES: Order["status"][] = ["paid", "fulfilled", "refunded"];

export function isPaidState(status: Order["status"]): boolean {
  return PAID_STATES.includes(status);
}

function nowIso() {
  return new Date().toISOString();
}

/** Mark an order paid from a confirmed Checkout Session. Returns the order and whether this call changed it. */
export async function markOrderPaidFromSession(
  order: Order,
  session: StripeCheckoutSession
): Promise<{ order: Order; newlyPaid: boolean }> {
  const ids = {
    stripeSessionId: session.id,
    ...(session.customer ? { stripeCustomerId: session.customer } : {}),
    ...(session.payment_intent ? { stripePaymentIntentId: session.payment_intent } : {}),
    ...(session.subscription ? { stripeSubscriptionId: session.subscription, subscriptionStatus: "active" as const } : {}),
    stripeLivemode: session.livemode,
    currency: session.currency || "usd",
  };
  await Promise.all([
    setIndex("session", session.id, order.id),
    session.payment_intent ? setIndex("pi", session.payment_intent, order.id) : Promise.resolve(),
    session.subscription ? setIndex("sub", session.subscription, order.id) : Promise.resolve(),
    session.customer ? setIndex("customer", session.customer, order.id) : Promise.resolve(),
  ]);

  if (isPaidState(order.status)) {
    const updated = (await updateOrder(order.id, { ...ids, updatedAt: nowIso() })) || order;
    return { order: updated, newlyPaid: false };
  }

  const paidAt = nowIso();
  const patch: Partial<Order> = {
    ...ids,
    status: "paid",
    paidAt,
    updatedAt: paidAt,
    fulfillment: order.fulfillment || { state: "pending", attempts: 0, deliveries: [] },
  };
  if (session.mode === "payment") {
    patch.amountPaidCents = session.amount_total ?? Math.round(order.subtotal * 100);
    await putRevenue({
      id: `payment-${session.id}`,
      orderId: order.id,
      kind: "payment",
      amountCents: patch.amountPaidCents,
      currency: session.currency || "usd",
      at: paidAt,
      livemode: session.livemode,
      source: session.id,
      ...(session.payment_intent ? { paymentIntentId: session.payment_intent } : {}),
    });
  }
  const updated = (await updateOrder(order.id, patch)) || { ...order, ...patch };

  if (session.mode === "payment") {
    await maybeCreateCommission(updated, {
      sourceId: session.id,
      paymentIntentId: session.payment_intent || undefined,
      baseCents: commissionBase({
        total: session.amount_total,
        tax: session.total_details?.amount_tax,
        shipping: session.total_details?.amount_shipping,
      }),
      currency: session.currency || "usd",
      paidAt,
      livemode: session.livemode,
      buyerEmails: [session.customer_details?.email, session.customer_email, order.email],
      paymentIndex: 1,
    });
  }
  return { order: updated, newlyPaid: true };
}

/** Commission for one payment, when the order carries a valid, active, non-self partner ref. */
export async function maybeCreateCommission(
  order: Order,
  pay: {
    sourceId: string;
    paymentIntentId?: string;
    baseCents: number;
    currency: string;
    paidAt: string;
    livemode: boolean;
    buyerEmails: Array<string | null | undefined>;
    paymentIndex: number;
  }
): Promise<"created" | "exists" | "none" | "self_referral" | "inactive_partner" | "not_earning"> {
  if (!order.ref || order.refRejected) return "none";
  const partner = await getPartner(order.ref);
  if (!partner || partner.status !== "active") {
    await updateOrder(order.id, { refRejected: "inactive_partner" });
    return "inactive_partner";
  }
  if (isSelfReferral(partner.email, pay.buyerEmails)) {
    await updateOrder(order.id, { refRejected: "self_referral" });
    return "self_referral";
  }
  if (!earnsOnPayment(partner, pay.paymentIndex)) return "not_earning";
  if (pay.baseCents <= 0) return "none";
  const created = await createCommissionOnce(
    newCommission({
      id: `c-${pay.sourceId}`,
      partner,
      orderId: order.id,
      sourceId: pay.sourceId,
      paymentIntentId: pay.paymentIntentId,
      baseCents: pay.baseCents,
      currency: pay.currency,
      paidAt: pay.paidAt,
      refundWindowDays: refundWindowDays(),
      livemode: pay.livemode,
    })
  );
  return created ? "created" : "exists";
}

/** Record a paid subscription invoice (first or renewal). */
export async function recordInvoicePayment(
  order: Order,
  invoice: {
    id: string;
    amountPaidCents: number;
    taxCents: number;
    currency: string;
    livemode: boolean;
    paymentIntentId?: string;
    subscriptionId?: string;
    customerId?: string;
    customerEmail?: string | null;
  }
): Promise<{ order: Order; newlyPaid: boolean }> {
  const at = nowIso();
  if (invoice.paymentIntentId) await setIndex("pi", invoice.paymentIntentId, order.id);
  if (invoice.subscriptionId) await setIndex("sub", invoice.subscriptionId, order.id);
  if (invoice.customerId) await setIndex("customer", invoice.customerId, order.id);
  if (invoice.amountPaidCents > 0) {
    await putRevenue({
      id: `payment-${invoice.id}`,
      orderId: order.id,
      kind: "payment",
      amountCents: invoice.amountPaidCents,
      currency: invoice.currency,
      at,
      livemode: invoice.livemode,
      source: invoice.id,
      ...(invoice.paymentIntentId ? { paymentIntentId: invoice.paymentIntentId } : {}),
    });
  }
  const payments = (await listRevenue())
    .filter((r) => r.orderId === order.id && r.kind === "payment")
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const amountPaidCents = payments.reduce((sum, r) => sum + r.amountCents, 0);
  const index = payments.findIndex((r) => r.id === `payment-${invoice.id}`);

  const newlyPaid = !isPaidState(order.status);
  const patch: Partial<Order> = {
    amountPaidCents,
    currency: invoice.currency,
    stripeLivemode: invoice.livemode,
    updatedAt: at,
    ...(invoice.subscriptionId ? { stripeSubscriptionId: invoice.subscriptionId, subscriptionStatus: "active" as const } : {}),
    ...(invoice.customerId ? { stripeCustomerId: invoice.customerId } : {}),
  };
  if (newlyPaid) {
    patch.status = "paid";
    patch.paidAt = at;
    patch.fulfillment = order.fulfillment || { state: "pending", attempts: 0, deliveries: [] };
  }
  const updated = (await updateOrder(order.id, patch)) || { ...order, ...patch };
  if (invoice.amountPaidCents > 0) {
    await maybeCreateCommission(updated, {
      sourceId: invoice.id,
      paymentIntentId: invoice.paymentIntentId,
      baseCents: commissionBase({ total: invoice.amountPaidCents, tax: invoice.taxCents }),
      currency: invoice.currency,
      paidAt: at,
      livemode: invoice.livemode,
      buyerEmails: [invoice.customerEmail, order.email],
      paymentIndex: index >= 0 ? index + 1 : payments.length,
    });
  }
  return { order: updated, newlyPaid };
}

/** Apply a (cumulative) refund on one charge: ledger, order totals/status, and the matching commission. */
export async function recordRefund(
  order: Order,
  charge: { id: string; amountRefundedCents: number; currency: string; livemode: boolean; paymentIntentId?: string }
): Promise<Order> {
  const at = nowIso();
  await putRevenue({
    id: `refund-${charge.id}`,
    orderId: order.id,
    kind: "refund",
    amountCents: -Math.abs(charge.amountRefundedCents),
    currency: charge.currency,
    at,
    livemode: charge.livemode,
    source: charge.id,
    ...(charge.paymentIntentId ? { paymentIntentId: charge.paymentIntentId } : {}),
  });
  const ledger = (await listRevenue()).filter((r) => r.orderId === order.id);
  const refunded = ledger.filter((r) => r.kind === "refund").reduce((sum, r) => sum + Math.abs(r.amountCents), 0);
  const paid = Math.max(order.amountPaidCents || 0, ledger.filter((r) => r.kind === "payment").reduce((s, r) => s + r.amountCents, 0));
  const patch: Partial<Order> = { amountRefundedCents: refunded, updatedAt: at };
  if (paid > 0 && refunded >= paid) {
    patch.status = "refunded";
    patch.refundedAt = order.refundedAt || at;
  }
  const updated = (await updateOrder(order.id, patch)) || { ...order, ...patch };

  const commissions = (await listCommissions()).filter((c) => c.orderId === order.id);
  const target =
    commissions.find((c) => charge.paymentIntentId && c.paymentIntentId === charge.paymentIntentId) ||
    [...commissions].sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0];
  if (target) {
    const next = applyRefundToCommission(target, charge.amountRefundedCents, at);
    if (next !== target) await putCommission(next);
  }
  return updated;
}

export async function markSubscriptionCanceled(order: Order): Promise<Order> {
  if (order.subscriptionStatus === "canceled") return order;
  const at = nowIso();
  return (await updateOrder(order.id, { subscriptionStatus: "canceled", canceledAt: at, updatedAt: at })) || order;
}

export async function markOrderPaymentFailed(order: Order): Promise<Order> {
  if (isPaidState(order.status)) return order;
  const at = nowIso();
  return (await updateOrder(order.id, { status: "failed", failedAt: at, updatedAt: at })) || order;
}

export { findOrderById };
