/** Read model for the SiteFlow factory bay and /api/health. Never includes secrets or customer emails in health. */
import { catalog, displayPrice, isListedProduct, isPurchasable } from "@/data/products";
import { AFFILIATE_PROGRAMS, isProgramTracked, toolsPageListed } from "@/lib/affiliates";
import { listOrders, type Order } from "@/lib/store";
import { effectiveStatus, refundWindowDays } from "./commission-math";
import { listPrivateFiles } from "./private-files";
import { refWindowDays } from "./ref";
import {
  listClicks,
  listCommissions,
  listFailures,
  listPartners,
  listRevenue,
  readStripeStatus,
  readWebhookSeen,
  type Partner,
  type StripeCatalogStatus,
  type WebhookSeen,
} from "./state";
import { stripeKeyMode, stripeSecretKey, type StripeKeyMode } from "./stripe";
import { webhookSecrets } from "./stripe-signature";
import { downloadSigningConfigured } from "./tokens";

export type SiteFlowSummary = {
  stripeMode: StripeKeyMode;
  webhookSecretSet: boolean;
  downloadSigningSet: boolean;
  webhook: WebhookSeen | null;
  stripeStatus: StripeCatalogStatus | null;
  refWindowDays: number;
  refundWindowDays: number;
  catalog: Array<{
    slug: string;
    name: string;
    kind: string;
    listed: boolean;
    retired: boolean;
    price: string | null;
    purchasable: boolean;
    lookupKey: string | null;
    deliverable: string;
    fileUploaded: boolean | null;
  }>;
  ordersByStatus: Record<string, number>;
  recentOrders: Array<Pick<Order, "id" | "status" | "createdAt" | "subtotal" | "ref" | "refRejected" | "subscriptionStatus"> & {
    items: string;
    fulfillment: string;
    livemode: boolean | null;
  }>;
  manualTodo: Array<{ id: string; items: string; paidAt: string }>;
  failures: Array<{ orderId: string; at: string; attempts: number; error: string; stage: string }>;
  revenue: { testCents: number; liveCents: number; refundsTestCents: number; refundsLiveCents: number; payments: number };
  partners: Array<Partner & { pendingCents: number; approvedCents: number; paidCents: number; orders: number }>;
  commissions: { pendingCents: number; approvedCents: number; paidCents: number; voidCount: number; pendingCount: number; approvedCount: number };
  clicks: { total: number; last30: number; bySlug: Record<string, number>; tracked: number };
  programs: Array<{ slug: string; name: string; tracked: boolean; envVar: string }>;
  toolsPageListed: boolean;
  errors: string[];
};

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${label}: ${err instanceof Error ? err.name : "unavailable"}`);
    return fallback;
  }
}

export function deliverableLabel(d: (typeof catalog)[number]["deliverable"]): string {
  if (!d) return "none";
  if (d.type === "file") return `file ${d.fileKey}`;
  if (d.type === "generator") return `generator ${d.generator}`;
  return "manual";
}

export async function summarizeSiteFlow(): Promise<SiteFlowSummary> {
  const errors: string[] = [];
  const [orders, revenue, commissions, partners, clicks, failures, webhook, stripeStatus, files] = await Promise.all([
    safe("orders", listOrders, [], errors),
    safe("revenue", listRevenue, [], errors),
    safe("commissions", listCommissions, [], errors),
    safe("partners", listPartners, [], errors),
    safe("clicks", () => listClicks(2000), [], errors),
    safe("failures", listFailures, [], errors),
    safe("webhook", readWebhookSeen, null, errors),
    safe("stripe status", readStripeStatus, null, errors),
    safe("deliverables", () => listPrivateFiles("kits"), [] as string[], errors),
  ]);
  const now = Date.now();

  const ordersByStatus: Record<string, number> = {};
  for (const o of orders) ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;

  const rev = { testCents: 0, liveCents: 0, refundsTestCents: 0, refundsLiveCents: 0, payments: 0 };
  for (const r of revenue) {
    if (r.kind === "payment") {
      rev.payments += 1;
      if (r.livemode) rev.liveCents += r.amountCents;
      else rev.testCents += r.amountCents;
    } else if (r.livemode) rev.refundsLiveCents += Math.abs(r.amountCents);
    else rev.refundsTestCents += Math.abs(r.amountCents);
  }

  const comm = { pendingCents: 0, approvedCents: 0, paidCents: 0, voidCount: 0, pendingCount: 0, approvedCount: 0 };
  const perPartner = new Map<string, { pendingCents: number; approvedCents: number; paidCents: number; orders: Set<string> }>();
  for (const c of commissions) {
    const status = effectiveStatus(c, now);
    const p = perPartner.get(c.partnerCode) || { pendingCents: 0, approvedCents: 0, paidCents: 0, orders: new Set<string>() };
    p.orders.add(c.orderId);
    if (status === "pending") {
      comm.pendingCents += c.commissionCents;
      comm.pendingCount += 1;
      p.pendingCents += c.commissionCents;
    } else if (status === "approved") {
      comm.approvedCents += c.commissionCents;
      comm.approvedCount += 1;
      p.approvedCents += c.commissionCents;
    } else if (status === "paid") {
      comm.paidCents += c.commissionCents;
      p.paidCents += c.commissionCents;
    } else comm.voidCount += 1;
    perPartner.set(c.partnerCode, p);
  }

  const bySlug: Record<string, number> = {};
  let last30 = 0;
  let tracked = 0;
  for (const c of clicks) {
    bySlug[c.slug] = (bySlug[c.slug] || 0) + 1;
    if (now - Date.parse(c.at) <= 30 * 86_400_000) last30 += 1;
    if (c.tracked) tracked += 1;
  }

  const itemNames = (o: Order) => o.items.map((i) => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ");

  return {
    stripeMode: stripeKeyMode(stripeSecretKey()),
    webhookSecretSet: webhookSecrets().length > 0,
    downloadSigningSet: downloadSigningConfigured(),
    webhook,
    stripeStatus,
    refWindowDays: refWindowDays(),
    refundWindowDays: refundWindowDays(),
    catalog: catalog.map((e) => ({
      slug: e.slug,
      name: e.name,
      kind: e.kind,
      listed: isListedProduct(e),
      retired: Boolean(e.retired),
      price: displayPrice(e) || null,
      purchasable: isPurchasable(e),
      lookupKey: e.stripeLookupKey || null,
      deliverable: deliverableLabel(e.deliverable),
      fileUploaded: e.deliverable?.type === "file" ? files.includes(e.deliverable.fileKey) : null,
    })),
    ordersByStatus,
    recentOrders: orders.slice(0, 25).map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt,
      subtotal: o.subtotal,
      ref: o.ref,
      refRejected: o.refRejected,
      subscriptionStatus: o.subscriptionStatus,
      items: itemNames(o),
      fulfillment: o.fulfillment ? `${o.fulfillment.state}${o.fulfillment.attempts ? ` (${o.fulfillment.attempts} attempt${o.fulfillment.attempts > 1 ? "s" : ""})` : ""}` : "—",
      livemode: typeof o.stripeLivemode === "boolean" ? o.stripeLivemode : null,
    })),
    manualTodo: orders
      .filter((o) => o.status === "paid" && o.fulfillment?.state === "manual")
      .map((o) => ({ id: o.id, items: itemNames(o), paidAt: o.paidAt || "" })),
    failures: failures
      .filter((f) => !f.resolvedAt)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((f) => ({ orderId: f.orderId, at: f.at, attempts: f.attempts, error: f.error, stage: f.stage })),
    revenue: rev,
    partners: partners
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((p) => {
        const agg = perPartner.get(p.code);
        return {
          ...p,
          pendingCents: agg?.pendingCents || 0,
          approvedCents: agg?.approvedCents || 0,
          paidCents: agg?.paidCents || 0,
          orders: agg?.orders.size || 0,
        };
      }),
    commissions: comm,
    clicks: { total: clicks.length, last30, bySlug, tracked },
    programs: AFFILIATE_PROGRAMS.map((p) => ({ slug: p.slug, name: p.name, tracked: isProgramTracked(p), envVar: p.envVar })),
    toolsPageListed: toolsPageListed(),
    errors,
  };
}

/** Minimal, unauthenticated health fields (booleans / mode words / one timestamp). */
export async function siteflowHealth(): Promise<{
  stripeMode: StripeKeyMode;
  webhookSecret: boolean;
  webhookLastSeenAt: string | null;
  downloadSigning: boolean;
}> {
  let seen: WebhookSeen | null = null;
  try {
    seen = await readWebhookSeen();
  } catch {
    seen = null;
  }
  return {
    stripeMode: stripeKeyMode(stripeSecretKey()),
    webhookSecret: webhookSecrets().length > 0,
    webhookLastSeenAt: seen?.at || null,
    downloadSigning: downloadSigningConfigured(),
  };
}
