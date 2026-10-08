#!/usr/bin/env node
// Local end-to-end check without Stripe: post a signed fake Stripe event to the local webhook.
//
//   STRIPE_WEBHOOK_SECRET=whsec_local_test node scripts/siteflow/send-test-event.mjs paid <orderId> [amountCents]
//   STRIPE_WEBHOOK_SECRET=whsec_local_test node scripts/siteflow/send-test-event.mjs refund <orderId> [amountCents]
//
// The dev server must run with the same STRIPE_WEBHOOK_SECRET. Only localhost / 127.0.0.1 targets are allowed
// (SITEFLOW_WEBHOOK_URL, default http://127.0.0.1:3000/api/stripe/webhook). The secret is never printed.
import { createHmac, randomBytes } from "node:crypto";

const [kind = "paid", orderId, amountArg] = process.argv.slice(2);
const secret = (process.env.STRIPE_WEBHOOK_SECRET || "").split(",")[0].trim();
const target = new URL(process.env.SITEFLOW_WEBHOOK_URL || "http://127.0.0.1:3000/api/stripe/webhook");
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
  console.error("Refusing: this script only posts to a local dev server.");
  process.exit(1);
}
if (!secret || !orderId || !["paid", "refund"].includes(kind)) {
  console.error("Usage: STRIPE_WEBHOOK_SECRET=... node scripts/siteflow/send-test-event.mjs paid|refund <orderId> [amountCents]");
  process.exit(1);
}
const amount = Number(amountArg) || 0;
const suffix = orderId.replace(/[^a-z0-9]/gi, "").slice(-16);
const object =
  kind === "paid"
    ? {
        id: `cs_test_local_${suffix}`,
        object: "checkout.session",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        amount_total: amount || null,
        currency: "usd",
        payment_intent: `pi_test_local_${suffix}`,
        customer: `cus_test_local_${suffix}`,
        client_reference_id: orderId,
        metadata: { orderId, siteflow: "1" },
        total_details: { amount_tax: 0, amount_shipping: 0 },
        livemode: false,
      }
    : {
        id: `ch_test_local_${suffix}`,
        object: "charge",
        amount_refunded: amount,
        currency: "usd",
        payment_intent: `pi_test_local_${suffix}`,
        metadata: { orderId },
      };
const event = {
  id: `evt_test_local_${randomBytes(8).toString("hex")}`,
  object: "event",
  type: kind === "paid" ? "checkout.session.completed" : "charge.refunded",
  livemode: false,
  created: Math.floor(Date.now() / 1000),
  data: { object },
};
const body = JSON.stringify(event);
const t = Math.floor(Date.now() / 1000);
const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
const res = await fetch(target, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${v1}` }, body });
console.log(`${event.type} ${event.id} → HTTP ${res.status} ${await res.text()}`);
