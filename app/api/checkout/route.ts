import { NextRequest, NextResponse } from "next/server";
import { siteflowEnabled, siteflowPausedResponse } from "@/lib/siteflow/flag";
import { quoteCart } from "@/lib/catalog";
import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isSelfReferral, normalizeRefCode, REF_COOKIE } from "@/lib/siteflow/ref";
import { activePartner } from "@/lib/siteflow/state";
import { createStripeCheckoutSession, isStripeConfigured } from "@/lib/stripe-checkout";
import { appendOrder, newId, updateOrder, type Order } from "@/lib/store";
import {
  asNonEmptyString,
  isValidEmail,
  normalizeEmail,
} from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(req: NextRequest): string {
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function thankYou(orderId: string): string {
  return `/thank-you?order=${encodeURIComponent(orderId)}`;
}

export async function POST(req: NextRequest) {
  // SiteFlow is paused (Path A) unless SITEFLOW_ENABLED is set; middleware also 404s this path.
  if (!siteflowEnabled()) return siteflowPausedResponse();
  try {
    ensureBlobsFromRequest(req);
    if (!rateLimit(`checkout:${clientKey(req)}`, 10, 60_000).ok) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
    }
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const name = asNonEmptyString(body?.name, 120);

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

    // Postal address only when something in the cart ships. Digital/service carts never collect one.
    const address = quoted.requiresShipping ? asNonEmptyString(body?.address, 200) : "";
    const city = quoted.requiresShipping ? asNonEmptyString(body?.city, 80) : "";
    const zip = quoted.requiresShipping ? asNonEmptyString(body?.zip, 20) : "";

    // Partner attribution: the HttpOnly cookie set by /api/siteflow/ref, re-validated now.
    let ref: string | undefined;
    let refRejected: Order["refRejected"];
    const cookieCode = normalizeRefCode(req.cookies.get(REF_COOKIE)?.value);
    if (cookieCode) {
      const partner = await activePartner(cookieCode).catch(() => null);
      if (partner) {
        ref = partner.code;
        if (isSelfReferral(partner.email, [email])) refRejected = "self_referral";
      }
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
      mode: quoted.mode,
      requiresShipping: quoted.requiresShipping,
      ...(Object.keys(quoted.fulfillmentInputs).length ? { fulfillmentInputs: quoted.fulfillmentInputs } : {}),
      ...(ref ? { ref } : {}),
      ...(refRejected ? { refRejected } : {}),
      siteOrigin: origin,
    });

    if (stripeReady) {
      try {
        const session = await createStripeCheckoutSession({ order, origin });
        await updateOrder(order.id, { stripeCheckoutUrl: session.url, stripeSessionId: session.id });
        // Payment is confirmed only by the webhook / server-side session check, never by this redirect.
        return NextResponse.json({
          ok: true,
          orderId: order.id,
          checkoutUrl: session.url,
          redirect: session.url,
        });
      } catch (err) {
        console.error("Stripe checkout error:", err instanceof Error ? err.message : "unknown");
        await updateOrder(order.id, { status: "email_only" });
        await sendMail({
          to: getNotifyEmail(),
          subject: `SiteFlow order ${order.id} needs a payment link (Stripe checkout failed)`,
          text: `Stripe Checkout could not be created for order ${order.id} (${order.name} <${order.email}>), total $${order.subtotal.toFixed(2)}. Send a payment link manually.`,
          replyTo: email,
        }).catch(() => undefined);
        return NextResponse.json({
          ok: true,
          orderId: order.id,
          redirect: thankYou(order.id),
          warning: "Order saved. Online payment is unavailable right now, so we'll email you a payment link.",
        });
      }
    }

    // No Stripe: the order is recorded only. Nothing is charged and nothing is delivered automatically.
    const itemLines = order.items
      .map((item) => `- ${item.name} x${item.quantity} @ $${item.unitAmount.toFixed(2)} = $${item.lineTotal.toFixed(2)}`)
      .join("\n");
    const summary = `Order ${order.id}\n${order.name} <${order.email}>\n\n${itemLines}\n\nTotal: $${order.subtotal.toFixed(2)}\nStatus: recorded (no payment collected)\nPlaced: ${order.createdAt}`;
    let emailed = false;
    try {
      const notify = await sendMail({
        to: getNotifyEmail(),
        subject: `New SiteFlow order ${order.id} ($${order.subtotal.toFixed(2)}), payment link needed`,
        text: summary,
        replyTo: email,
      });
      const customer = await sendMail({
        to: email,
        subject: `We received your Sitesinc order (${order.id})`,
        text: `Thanks ${order.name}. We recorded your order. No payment was taken; we'll email you a payment link from ${getNotifyEmail()}.\n\n${summary}`,
      });
      emailed = notify.sent && customer.sent;
    } catch (err) {
      console.error("Checkout email error:", err instanceof Error ? err.name : "unknown");
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      redirect: thankYou(order.id),
      ...(!isMailConfigured() || !emailed ? { warning: "Order saved. Email delivery is not available right now." } : {}),
    });
  } catch (err) {
    console.error("Checkout error:", err instanceof Error ? err.name : "unknown");
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't place that order. Please try again in a minute.",
      },
      { status: 502 }
    );
  }
}
