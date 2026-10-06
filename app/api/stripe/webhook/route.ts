import { NextRequest, NextResponse } from "next/server";
import { getNotifyEmail, sendMail } from "@/lib/mail";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { runAfterResponse } from "@/lib/siteflow/after";
import { fulfillOrder } from "@/lib/siteflow/fulfillment";
import { recordWebhookRejected } from "@/lib/siteflow/state";
import { verifyStripeSignature, webhookSecrets } from "@/lib/siteflow/stripe-signature";
import { processStripeEvent, type StripeEvent } from "@/lib/siteflow/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stripe → POST /api/stripe/webhook. The signature is verified on the raw body before anything is parsed.
 * 400 bad signature, 503 webhook secret not configured, 500 processing failed (Stripe retries),
 * 200 processed / duplicate / ignored. Responses never echo payloads or secrets.
 */
export async function POST(req: NextRequest) {
  ensureBlobsFromRequest(req);
  const secrets = webhookSecrets();
  if (!secrets.length) {
    return NextResponse.json({ ok: false, error: "Webhook is not configured." }, { status: 503 });
  }
  const raw = await req.text();
  const check = verifyStripeSignature(raw, req.headers.get("stripe-signature"), secrets);
  if (!check.ok) {
    await recordWebhookRejected(check.reason).catch(() => undefined);
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  try {
    const result = await processStripeEvent(event, {
      onPaid: (orderId) => runAfterResponse(`fulfill ${orderId}`, () => fulfillOrder(orderId)),
      onSubscriptionCanceled: (orderId) =>
        runAfterResponse(`cancel notice ${orderId}`, () =>
          sendMail({
            to: getNotifyEmail(),
            subject: `SiteFlow: subscription canceled (${orderId})`,
            text: `The subscription on order ${orderId} was canceled in Stripe. Stop the service (e.g. monitoring) for this customer.`,
          })
        ),
    });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("Stripe webhook processing failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ ok: false, error: "Processing failed; Stripe will retry." }, { status: 500 });
  }
}
