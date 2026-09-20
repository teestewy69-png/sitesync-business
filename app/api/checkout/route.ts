import { NextRequest, NextResponse } from "next/server";
import { quoteCart } from "@/lib/catalog";
import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import { createStripeCheckoutUrl, isStripeConfigured } from "@/lib/stripe-checkout";
import { appendOrder, newId, updateOrder } from "@/lib/store";
import {
  asNonEmptyString,
  isValidEmail,
  normalizeEmail,
} from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const name = asNonEmptyString(body?.name, 120);
    const address = asNonEmptyString(body?.address, 200);
    const city = asNonEmptyString(body?.city, 80);
    const zip = asNonEmptyString(body?.zip, 20);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Please enter your name." },
        { status: 400 }
      );
    }

    let quoted;
    try {
      quoted = quoteCart(Array.isArray(body?.lines) ? body.lines : []);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Your cart is empty.",
        },
        { status: 400 }
      );
    }

    const origin = requestOrigin(req);
    const stripeReady = isStripeConfigured();
    const order = await appendOrder({
      id: newId("ord"),
      status: stripeReady ? "awaiting_stripe" : "recorded",
      email,
      name,
      address,
      city,
      zip,
      items: quoted.items,
      subtotal: quoted.subtotal,
      createdAt: new Date().toISOString(),
    });

    const itemLines = order.items
      .map(
        (item) =>
          `- ${item.name} x${item.quantity} @ $${item.unitAmount.toFixed(2)} = $${item.lineTotal.toFixed(2)}`
      )
      .join("\n");

    const summary = `Order ${order.id}
${order.name} <${order.email}>
${order.address}
${order.city} ${order.zip}

${itemLines}

Total: $${order.subtotal.toFixed(2)}
Status: ${order.status}
Placed: ${order.createdAt}`;

    let emailed = false;
    try {
      const notify = await sendMail({
        to: getNotifyEmail(),
        subject: `New shop order ${order.id} ($${order.subtotal.toFixed(2)})`,
        text: summary,
        replyTo: email,
      });

      const customer = await sendMail({
        to: email,
        subject: `We received your Sitesync order (${order.id})`,
        text: `Thanks ${order.name} — we recorded your order.\n\n${summary}\n\nWe'll follow up from ${getNotifyEmail()} if anything else is needed.`,
      });
      emailed = notify.sent && customer.sent;
    } catch (err) {
      emailed = false;
      console.error("Checkout email error:", err);
    }

    if (stripeReady) {
      try {
        const checkoutUrl = await createStripeCheckoutUrl({ order, origin });
        await updateOrder(order.id, { stripeCheckoutUrl: checkoutUrl });
        return NextResponse.json({
          ok: true,
          orderId: order.id,
          checkoutUrl,
          redirect: checkoutUrl,
        });
      } catch (err) {
        console.error("Stripe checkout error:", err);
        await updateOrder(order.id, { status: "email_only" });
        return NextResponse.json({
          ok: true,
          orderId: order.id,
          redirect: `/thank-you?product=ebook&order=${encodeURIComponent(order.id)}`,
          warning:
            "Order saved. Stripe checkout is unavailable, so we'll email a payment link.",
        });
      }
    }

    if (!isMailConfigured() || !emailed) {
      return NextResponse.json({
        ok: true,
        orderId: order.id,
        redirect: `/thank-you?product=ebook&order=${encodeURIComponent(order.id)}`,
        warning: "Order saved. Email delivery is not available right now.",
      });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      redirect: `/thank-you?product=ebook&order=${encodeURIComponent(order.id)}`,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't place that order. Please try again in a minute.",
      },
      { status: 502 }
    );
  }
}
