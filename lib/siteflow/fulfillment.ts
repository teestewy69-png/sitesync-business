/**
 * Fulfillment: turn a paid order into deliverables + a delivery email.
 *  - file      → must exist in the private deliverables store (uploaded from the SiteFlow bay).
 *  - generator → DomainIQ report / SEO audit, generated once per order and saved privately.
 *  - manual    → nothing to download; Tony is notified to do it by hand (e.g. monitoring onboarding).
 * Runs after the response (after()), retries transient failures with backoff, and writes a sanitized
 * failure record the bay can retry. Delivery links are signed, expiring /api/download/[token] URLs.
 */
import { getCatalogEntry } from "@/data/products";
import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import { findOrderById, updateOrder, type Order, type OrderDelivery } from "@/lib/store";
import { generateDomainIQReport } from "./generators/domainiq-report";
import { NonRetryableError } from "./generators/errors";
import { generateSeoAuditReport } from "./generators/seo-audit";
import { esc } from "./html";
import { isPaidState } from "./orders";
import { privateFileExists, writePrivateFile } from "./private-files";
import { safeError } from "./sanitize";
import { putFailure, resolveFailure } from "./state";
import { downloadSigningSecret, downloadTtlHours, signDownloadToken } from "./tokens";

const DEFAULT_BACKOFF_MS = [0, 3000, 10000];

export type FulfillResult = {
  ok: boolean;
  state: "delivered" | "manual" | "failed" | "skipped";
  note: string;
};

function siteOrigin(order: Order): string {
  return (order.siteOrigin || process.env.NEXT_PUBLIC_SITE_URL || "https://sitesinc.co").replace(/\/$/, "");
}

export function downloadUrl(order: Order, d: OrderDelivery, origin = siteOrigin(order)): string | null {
  const secret = downloadSigningSecret();
  if (!secret || d.state !== "ready") return null;
  const exp = Math.floor(Date.now() / 1000) + downloadTtlHours() * 3600;
  const token = signDownloadToken({ o: order.id, k: d.fileKey, f: d.filename, exp }, secret);
  return `${origin}/api/download/${token}`;
}

async function produce(order: Order, slug: string, existing?: OrderDelivery): Promise<OrderDelivery> {
  if (existing?.state === "ready" || existing?.state === "manual") return existing;
  const entry = getCatalogEntry(slug);
  const deliverable = entry?.deliverable;
  if (!entry || !deliverable || deliverable.type === "manual") {
    return { slug, fileKey: "", filename: "", state: "manual" };
  }
  if (deliverable.type === "file") {
    if (!(await privateFileExists(deliverable.fileKey))) {
      throw new Error(`Deliverable file "${deliverable.fileKey}" is not uploaded yet (upload it in the SiteFlow bay, then retry).`);
    }
    return { slug, fileKey: deliverable.fileKey, filename: deliverable.filename, state: "ready", readyAt: new Date().toISOString() };
  }
  const inputs = order.fulfillmentInputs?.[slug] || {};
  const html =
    deliverable.generator === "domainiq-report"
      ? await generateDomainIQReport(inputs, { origin: siteOrigin(order) })
      : await generateSeoAuditReport(inputs);
  const fileKey = `orders/${order.id.toLowerCase()}/${slug}.html`;
  await writePrivateFile(fileKey, new TextEncoder().encode(html), "text/html; charset=utf-8");
  return { slug, fileKey, filename: deliverable.filename, state: "ready", readyAt: new Date().toISOString() };
}

export function deliveryEmail(order: Order, deliveries: OrderDelivery[], origin = siteOrigin(order)): { subject: string; text: string; html: string } {
  const ttl = downloadTtlHours();
  const lines: string[] = [];
  const htmlItems: string[] = [];
  for (const d of deliveries) {
    const name = order.items.find((i) => i.slug === d.slug)?.name || d.slug;
    if (d.state === "ready") {
      const url = downloadUrl(order, d, origin);
      if (!url) continue;
      lines.push(`${name}: ${url}`);
      htmlItems.push(`<li><strong>${esc(name)}</strong>: <a href="${esc(url)}">Download</a></li>`);
    } else if (d.state === "manual") {
      const note = "We'll set this up by hand and email you within one business day.";
      lines.push(`${name}: ${note}`);
      htmlItems.push(`<li><strong>${esc(name)}</strong>: ${esc(note)}</li>`);
    }
  }
  const subject = `Your Sitesinc order ${order.id}`;
  const text = `Thanks ${order.name}, your payment is confirmed.\n\n${lines.join("\n")}\n\nDownload links expire in ${ttl} hours. Reply to this email if you need a fresh link.\n\nOrder ${order.id}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#111">
<p>Thanks ${esc(order.name)}, your payment is confirmed.</p>
<ul>${htmlItems.join("")}</ul>
<p style="color:#555;font-size:13px">Download links expire in ${ttl} hours. Reply to this email if you need a fresh link.</p>
<p style="color:#555;font-size:13px">Order ${esc(order.id)}</p></div>`;
  return { subject, text, html };
}

function ownerSummary(order: Order, deliveries: OrderDelivery[], emailed: boolean): string {
  const items = order.items.map((i) => `- ${i.name} x${i.quantity} @ $${i.unitAmount.toFixed(2)}`).join("\n");
  const manual = deliveries.filter((d) => d.state === "manual").map((d) => `- MANUAL: ${d.slug}`).join("\n");
  const inputs = Object.entries(order.fulfillmentInputs || {})
    .map(([slug, v]) => `- ${slug}: ${Object.entries(v).map(([k, x]) => `${k}=${x}`).join(", ")}`)
    .join("\n");
  return `Order ${order.id} is PAID (${order.stripeLivemode ? "live" : "test"} mode).
Customer: ${order.name} <${order.email}>
${items}
Paid: $${((order.amountPaidCents ?? Math.round(order.subtotal * 100)) / 100).toFixed(2)}
${order.ref ? `Partner ref: ${order.ref}${order.refRejected ? ` (no commission: ${order.refRejected})` : ""}\n` : ""}${inputs ? `Inputs:\n${inputs}\n` : ""}${manual ? `Needs you:\n${manual}\n` : ""}Delivery email to customer: ${emailed ? "sent" : "NOT sent (see SiteFlow bay)"}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fulfill an order. Safe to call repeatedly: finished deliveries are reused, and a fulfilled order is
 * only re-emailed when `resend` is set (bay "Resend links").
 */
export async function fulfillOrder(
  orderId: string,
  opts: { backoffMs?: number[]; resend?: boolean; notifyOwner?: boolean } = {}
): Promise<FulfillResult> {
  let order = await findOrderById(orderId);
  if (!order) return { ok: false, state: "skipped", note: "Order not found." };
  if (!isPaidState(order.status) && order.status !== "failed") return { ok: false, state: "skipped", note: `Order is ${order.status}, not paid.` };
  if (order.status === "refunded") return { ok: false, state: "skipped", note: "Order was refunded." };
  if (order.status === "failed" && !order.paidAt) return { ok: false, state: "skipped", note: "Payment failed; nothing to fulfill." };
  if (order.status === "fulfilled" && order.fulfillment?.emailedAt && !opts.resend) {
    return { ok: true, state: "delivered", note: "Already fulfilled." };
  }

  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const prior = order.fulfillment || { state: "pending" as const, attempts: 0, deliveries: [] };
  let deliveries: OrderDelivery[] = prior.deliveries || [];
  let attempts = prior.attempts || 0;
  let lastError = "";
  let fatal = false;

  for (let i = 0; i < backoff.length; i++) {
    if (backoff[i]) await sleep(backoff[i]);
    attempts += 1;
    lastError = "";
    const next: OrderDelivery[] = [];
    for (const item of order.items) {
      const existing = deliveries.find((d) => d.slug === item.slug);
      try {
        next.push(await produce(order, item.slug, existing));
      } catch (err) {
        if (err instanceof NonRetryableError) fatal = true;
        lastError = safeError(err, "Deliverable failed");
        next.push({ slug: item.slug, fileKey: existing?.fileKey || "", filename: existing?.filename || "", state: "failed", error: lastError });
      }
    }
    deliveries = next;
    order =
      (await updateOrder(order.id, {
        fulfillment: { ...prior, state: "running", attempts, lastAttemptAt: new Date().toISOString(), deliveries, ...(lastError ? { lastError } : {}) },
      })) || order;
    if (!lastError || fatal) break;
  }

  if (lastError) {
    const at = new Date().toISOString();
    await updateOrder(order.id, {
      status: "failed",
      failedAt: at,
      fulfillment: { ...prior, state: "failed", attempts, lastAttemptAt: at, lastError, deliveries },
    });
    await putFailure({ orderId: order.id, at, attempts, error: lastError, stage: fatal ? "config" : "generate" });
    if (opts.notifyOwner !== false) {
      await sendMail({
        to: getNotifyEmail(),
        subject: `SiteFlow: fulfillment FAILED for ${order.id}`,
        text: `Order ${order.id} is paid but could not be fulfilled after ${attempts} attempt(s).\nError: ${lastError}\nRetry it from the SiteFlow bay on /app.`,
      }).catch(() => undefined);
    }
    return { ok: false, state: "failed", note: lastError };
  }

  // Deliverables ready: email the customer (with retries), then tell Tony.
  const mail = deliveryEmail(order, deliveries);
  let emailed = false;
  const hasLinks = deliveries.some((d) => d.state === "ready");
  if (!downloadSigningSecret() && hasLinks) {
    lastError = "DOWNLOAD_SIGNING_SECRET is not set, so download links cannot be issued.";
  } else if (!isMailConfigured()) {
    lastError = "SMTP is not configured, so the delivery email could not be sent.";
  } else {
    for (let i = 0; i < backoff.length && !emailed; i++) {
      if (backoff[i]) await sleep(backoff[i]);
      emailed = (await sendMail({ to: order.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: getNotifyEmail() }).catch(() => ({ sent: false }))).sent;
    }
    if (!emailed) lastError = "Delivery email could not be sent after retries (SMTP).";
  }

  const at = new Date().toISOString();
  const allManual = deliveries.every((d) => d.state === "manual");
  const anyManual = deliveries.some((d) => d.state === "manual");
  const state: FulfillResult["state"] = lastError ? "failed" : anyManual ? "manual" : "delivered";
  await updateOrder(order.id, {
    // Files are ready; a pure email problem leaves the order "paid" (links also show on the thank-you page).
    status: !lastError && !anyManual ? "fulfilled" : "paid",
    ...(!lastError && !anyManual ? { fulfilledAt: at } : {}),
    fulfillment: {
      ...prior,
      state: lastError ? "failed" : anyManual ? "manual" : "delivered",
      attempts,
      lastAttemptAt: at,
      deliveries,
      ...(emailed ? { emailedAt: at } : {}),
      ...(lastError ? { lastError } : { deliveredAt: at }),
    },
  });
  if (lastError) await putFailure({ orderId: order.id, at, attempts, error: lastError, stage: "email" });
  else await resolveFailure(order.id);

  if (opts.notifyOwner !== false) {
    await sendMail({
      to: getNotifyEmail(),
      subject: `SiteFlow: order ${order.id} paid${anyManual ? " (needs manual setup)" : ""}`,
      text: ownerSummary(order, deliveries, emailed),
      replyTo: order.email,
    }).catch(() => undefined);
  }
  return {
    ok: !lastError,
    state,
    note: lastError || (allManual ? "Manual service; Tony notified." : anyManual ? "Delivered; manual items pending." : "Delivered."),
  };
}

/** Bay "Retry": clear the failure and run again (resending the email). */
export async function retryFulfillment(orderId: string): Promise<FulfillResult> {
  const order = await findOrderById(orderId);
  if (!order) return { ok: false, state: "skipped", note: "Order not found." };
  if (order.status === "failed" && order.paidAt) {
    await updateOrder(orderId, { status: "paid" });
  }
  return fulfillOrder(orderId, { resend: true });
}

/** Bay "Mark done" for manual services (e.g. monitoring enrolled). */
export async function markManualFulfilled(orderId: string): Promise<Order | null> {
  const order = await findOrderById(orderId);
  if (!order || order.status !== "paid") return order;
  const at = new Date().toISOString();
  return updateOrder(orderId, {
    status: "fulfilled",
    fulfilledAt: at,
    fulfillment: { ...(order.fulfillment || { attempts: 0, deliveries: [] }), state: "delivered", deliveredAt: at },
  });
}
