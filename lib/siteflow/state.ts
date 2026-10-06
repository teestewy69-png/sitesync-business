/**
 * SiteFlow state in the shared document store (lib/persistence.ts): Netlify Blobs on Netlify
 * (`sitesinc-crm` / `sitesinc-crm-staging`), `data/siteflow/**` locally. Every key lives under `siteflow/`.
 */
import { listDocKeys, readDoc, writeDoc, isStoreConflict } from "@/lib/persistence";
import type { Commission } from "./commission-math";

const ROOT = "siteflow";
const ID_SAFE = /[^a-z0-9_.-]/gi;

function safeId(id: string): string {
  const cleaned = String(id || "").replace(ID_SAFE, "_").slice(0, 120);
  return /^[a-z0-9]/i.test(cleaned) ? cleaned : `x${cleaned}`;
}

async function readValue<T>(key: string): Promise<T | null> {
  return (await readDoc<T>(key))?.value ?? null;
}

async function listValues<T>(prefix: string, limit = 2000): Promise<T[]> {
  const keys = (await listDocKeys(prefix)).sort().slice(-limit);
  const out: T[] = [];
  for (const key of keys) {
    const value = await readValue<T>(key);
    if (value) out.push(value);
  }
  return out;
}

/* ---------------------------- webhook events (idempotency) ---------------------------- */

export type EventRecord = {
  id: string;
  type: string;
  state: "processing" | "done" | "failed";
  attempts: number;
  firstSeenAt: string;
  updatedAt: string;
  livemode?: boolean;
  error?: string;
};

const STALE_PROCESSING_MS = 2 * 60_000;

/**
 * Claim a Stripe event id. "claimed": process it now. "duplicate": already processed (ack 200, do nothing).
 * "in_progress": another delivery is processing it right now (ack; that delivery's response decides retries).
 * A failed or stale claim is taken over, so a crash mid-processing is retried on Stripe's next delivery.
 */
export async function claimEvent(
  eventId: string,
  type: string,
  livemode?: boolean
): Promise<"claimed" | "duplicate" | "in_progress"> {
  const key = `${ROOT}/events/${safeId(eventId)}`;
  const now = new Date().toISOString();
  const fresh: EventRecord = { id: eventId, type, state: "processing", attempts: 1, firstSeenAt: now, updatedAt: now, livemode };
  try {
    await writeDoc(key, fresh, { expectedVersion: null });
    return "claimed";
  } catch (err) {
    if (!isStoreConflict(err)) throw err;
  }
  const current = await readDoc<EventRecord>(key);
  if (!current) return claimEvent(eventId, type, livemode);
  const rec = current.value;
  if (rec.state === "done") return "duplicate";
  const stale = Date.now() - Date.parse(rec.updatedAt) > STALE_PROCESSING_MS;
  if (rec.state === "processing" && !stale) return "in_progress";
  try {
    await writeDoc(
      key,
      { ...rec, state: "processing", attempts: (rec.attempts || 1) + 1, updatedAt: now, error: undefined },
      { expectedVersion: current.version }
    );
    return "claimed";
  } catch (err) {
    if (isStoreConflict(err)) return "in_progress";
    throw err;
  }
}

export async function finishEvent(eventId: string, ok: boolean, error?: string): Promise<void> {
  const key = `${ROOT}/events/${safeId(eventId)}`;
  const current = await readValue<EventRecord>(key);
  if (!current) return;
  await writeDoc(key, {
    ...current,
    state: ok ? "done" : "failed",
    updatedAt: new Date().toISOString(),
    ...(ok ? { error: undefined } : { error: (error || "failed").slice(0, 300) }),
  });
}

export async function readEvent(eventId: string): Promise<EventRecord | null> {
  return readValue<EventRecord>(`${ROOT}/events/${safeId(eventId)}`);
}

/* ---------------------------------- webhook last seen ---------------------------------- */

export type WebhookSeen = {
  at: string;
  type: string;
  eventId: string;
  livemode: boolean;
  verified: boolean;
  /** Last signature failure (no payload, no secret). */
  lastRejectedAt?: string;
  lastRejectReason?: string;
};

export async function recordWebhookSeen(seen: Omit<WebhookSeen, "lastRejectedAt" | "lastRejectReason">): Promise<void> {
  const prev = await readValue<WebhookSeen>(`${ROOT}/webhook-last-seen`).catch(() => null);
  await writeDoc(`${ROOT}/webhook-last-seen`, { ...(prev || {}), ...seen });
}

export async function recordWebhookRejected(reason: string): Promise<void> {
  const prev = await readValue<WebhookSeen>(`${ROOT}/webhook-last-seen`).catch(() => null);
  await writeDoc(`${ROOT}/webhook-last-seen`, {
    ...(prev || { at: "", type: "", eventId: "", livemode: false, verified: false }),
    lastRejectedAt: new Date().toISOString(),
    lastRejectReason: reason,
  });
}

export async function readWebhookSeen(): Promise<WebhookSeen | null> {
  return readValue<WebhookSeen>(`${ROOT}/webhook-last-seen`);
}

/* ------------------------------------ lookup indexes ----------------------------------- */

export type IndexKind = "pi" | "sub" | "session" | "customer";

export async function setIndex(kind: IndexKind, stripeId: string, orderId: string): Promise<void> {
  if (!stripeId || !orderId) return;
  await writeDoc(`${ROOT}/index/${kind}/${safeId(stripeId)}`, { orderId, at: new Date().toISOString() });
}

export async function getIndex(kind: IndexKind, stripeId: string): Promise<string | null> {
  if (!stripeId) return null;
  return (await readValue<{ orderId: string }>(`${ROOT}/index/${kind}/${safeId(stripeId)}`))?.orderId || null;
}

/* ---------------------------------------- revenue -------------------------------------- */

export type RevenueEntry = {
  /** payment-<session or invoice id> | refund-<charge id> */
  id: string;
  orderId: string;
  kind: "payment" | "refund";
  /** Positive for payments; negative for refunds (cumulative per charge). */
  amountCents: number;
  currency: string;
  at: string;
  livemode: boolean;
  source: string;
  paymentIntentId?: string;
};

/** Idempotent: the id is derived from the Stripe object, so a replay overwrites the same entry. */
export async function putRevenue(entry: RevenueEntry): Promise<void> {
  await writeDoc(`${ROOT}/revenue/${safeId(entry.id)}`, entry);
}

export async function listRevenue(): Promise<RevenueEntry[]> {
  return listValues<RevenueEntry>(`${ROOT}/revenue`, 10000);
}

/* -------------------------------------- commissions ------------------------------------ */

export async function getCommission(id: string): Promise<Commission | null> {
  return readValue<Commission>(`${ROOT}/commissions/${safeId(id)}`);
}

export async function putCommission(c: Commission): Promise<void> {
  await writeDoc(`${ROOT}/commissions/${safeId(c.id)}`, c);
}

/** Create only (a replayed event can never create a second commission for the same payment). */
export async function createCommissionOnce(c: Commission): Promise<boolean> {
  try {
    await writeDoc(`${ROOT}/commissions/${safeId(c.id)}`, c, { expectedVersion: null });
    return true;
  } catch (err) {
    if (isStoreConflict(err)) return false;
    throw err;
  }
}

export async function listCommissions(): Promise<Commission[]> {
  return listValues<Commission>(`${ROOT}/commissions`, 10000);
}

/* --------------------------------------- partners -------------------------------------- */

export type Partner = {
  code: string;
  name: string;
  email: string;
  /** Commission percent of the paid base. Set per partner by Tony; no default. */
  ratePct: number;
  /** 0/1 = first payment only; N = first N paid subscription invoices. */
  recurringPayments: number;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export async function getPartner(code: string): Promise<Partner | null> {
  if (!code) return null;
  return readValue<Partner>(`${ROOT}/partners/${safeId(code)}`);
}

export async function createPartner(p: Partner): Promise<boolean> {
  try {
    await writeDoc(`${ROOT}/partners/${safeId(p.code)}`, p, { expectedVersion: null });
    return true;
  } catch (err) {
    if (isStoreConflict(err)) return false;
    throw err;
  }
}

export async function putPartner(p: Partner): Promise<void> {
  await writeDoc(`${ROOT}/partners/${safeId(p.code)}`, p);
}

export async function listPartners(): Promise<Partner[]> {
  return listValues<Partner>(`${ROOT}/partners`);
}

/** Active partner for a (normalized) code, or null. Used by the ref endpoint and checkout. */
export async function activePartner(code: string): Promise<Partner | null> {
  const partner = await getPartner(code);
  return partner && partner.status === "active" ? partner : null;
}

/* ------------------------------------ outbound clicks ---------------------------------- */

export type OutboundClick = {
  id: string;
  slug: string;
  at: string;
  /** Where on the site the link was (e.g. "domainiq-bay", "tools"). */
  src: string;
  /** Domain searched at a registrar, when the link carried one. */
  domain?: string;
  /** Referring host only (no full URL, no IP). */
  refererHost?: string;
  /** Was a program/affiliate id applied, or a plain link? */
  tracked: boolean;
};

export async function logClick(click: OutboundClick): Promise<void> {
  await writeDoc(`${ROOT}/clicks/${safeId(click.id)}`, click);
}

export async function listClicks(limit = 1000): Promise<OutboundClick[]> {
  return listValues<OutboundClick>(`${ROOT}/clicks`, limit);
}

/* ---------------------------------- fulfillment failures -------------------------------- */

export type FulfillmentFailure = {
  orderId: string;
  at: string;
  attempts: number;
  /** Sanitized: no secrets, no customer email. */
  error: string;
  stage: "generate" | "file" | "email" | "config";
  resolvedAt?: string;
};

export async function putFailure(f: FulfillmentFailure): Promise<void> {
  await writeDoc(`${ROOT}/failures/${safeId(f.orderId)}`, f);
}

export async function resolveFailure(orderId: string): Promise<void> {
  const key = `${ROOT}/failures/${safeId(orderId)}`;
  const current = await readValue<FulfillmentFailure>(key);
  if (current && !current.resolvedAt) await writeDoc(key, { ...current, resolvedAt: new Date().toISOString() });
}

export async function listFailures(): Promise<FulfillmentFailure[]> {
  return listValues<FulfillmentFailure>(`${ROOT}/failures`);
}

/* ------------------------------------- Stripe status ----------------------------------- */

export type StripeCatalogStatus = {
  checkedAt: string;
  mode: "test" | "live" | "unset" | "invalid";
  source: "runtime-check" | "sync-script";
  error?: string;
  items: Array<{
    slug: string;
    lookupKey: string;
    catalogCents: number | null;
    state: "in_sync" | "missing" | "amount_mismatch" | "unpriced" | "unchecked";
    priceId?: string;
    stripeCents?: number | null;
  }>;
};

export async function writeStripeStatus(status: StripeCatalogStatus): Promise<void> {
  await writeDoc(`${ROOT}/stripe-status`, status);
}

export async function readStripeStatus(): Promise<StripeCatalogStatus | null> {
  return readValue<StripeCatalogStatus>(`${ROOT}/stripe-status`);
}
