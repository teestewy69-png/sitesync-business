import type { Order } from "@/lib/store";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createStripeCheckoutUrl(opts: {
  order: Order;
  origin: string;
}): Promise<string> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("Stripe is not configured.");
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set(
    "success_url",
    `${opts.origin}/thank-you?product=ebook&order=${encodeURIComponent(opts.order.id)}`
  );
  body.set("cancel_url", `${opts.origin}/checkout`);
  body.set("customer_email", opts.order.email);
  body.set("client_reference_id", opts.order.id);
  body.set("metadata[orderId]", opts.order.id);

  opts.order.items.forEach((item, index) => {
    const cents = Math.round(item.unitAmount * 100);
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
    body.set(`line_items[${index}][price_data][currency]`, "usd");
    body.set(`line_items[${index}][price_data][unit_amount]`, String(cents));
    body.set(
      `line_items[${index}][price_data][product_data][name]`,
      item.name
    );
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    throw new Error(data.error?.message || "Stripe checkout could not be created.");
  }
  return data.url;
}
