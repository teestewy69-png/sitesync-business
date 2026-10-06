/**
 * Commission math (pure). Rates are per partner and set by Tony; there is no default rate anywhere.
 *
 * - base       = what the customer actually paid for goods: amount_total - tax - shipping (after discounts).
 * - commission = round(max(0, base - refunded) * ratePct / 100), in cents.
 * - pending → approved once the refund window has passed (approvableAt), void when fully refunded,
 *   paid when Tony marks the manual payout done.
 */

export type CommissionStatus = "pending" | "approved" | "void" | "paid";

export type Commission = {
  id: string;
  partnerCode: string;
  orderId: string;
  /** Stripe object the money came from (checkout session id or invoice id). */
  sourceId: string;
  paymentIntentId?: string;
  baseCents: number;
  refundedCents: number;
  ratePct: number;
  commissionCents: number;
  currency: string;
  status: CommissionStatus;
  createdAt: string;
  paidAt: string;
  approvableAt: string;
  approvedAt?: string;
  voidedAt?: string;
  payoutAt?: string;
  payoutMonth?: string;
  livemode?: boolean;
};

export type PartnerTerms = {
  code: string;
  name: string;
  email: string;
  ratePct: number;
  /** 0 = only the first payment earns; N = the first N paid invoices of a subscription earn. */
  recurringPayments: number;
};

const DEFAULT_REFUND_WINDOW_DAYS = 30;

export function refundWindowDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.SITEFLOW_REFUND_WINDOW_DAYS);
  return Number.isFinite(n) && n >= 0 && n <= 365 ? Math.floor(n) : DEFAULT_REFUND_WINDOW_DAYS;
}

export function isValidRate(ratePct: unknown): ratePct is number {
  return typeof ratePct === "number" && Number.isFinite(ratePct) && ratePct > 0 && ratePct <= 100;
}

export function commissionCents(baseCents: number, ratePct: number, refundedCents = 0): number {
  if (!isValidRate(ratePct)) return 0;
  const net = Math.max(0, Math.round(baseCents) - Math.max(0, Math.round(refundedCents)));
  return Math.round((net * ratePct) / 100);
}

/** Commission base from a Checkout Session or Invoice-like amounts (all cents). */
export function commissionBase(amounts: { total?: number | null; tax?: number | null; shipping?: number | null }): number {
  const total = Math.max(0, Math.round(amounts.total || 0));
  const tax = Math.max(0, Math.round(amounts.tax || 0));
  const shipping = Math.max(0, Math.round(amounts.shipping || 0));
  return Math.max(0, total - tax - shipping);
}

export function approvableAtIso(paidAtIso: string, windowDays: number): string {
  const paid = Date.parse(paidAtIso);
  const base = Number.isFinite(paid) ? paid : Date.now();
  return new Date(base + windowDays * 86_400_000).toISOString();
}

/** Does subscription payment number `paymentIndex` (1 = first) earn commission under these terms? */
export function earnsOnPayment(terms: Pick<PartnerTerms, "recurringPayments">, paymentIndex: number): boolean {
  if (paymentIndex <= 1) return true;
  return paymentIndex <= Math.max(1, Math.floor(terms.recurringPayments || 0));
}

export function newCommission(input: {
  id: string;
  partner: PartnerTerms;
  orderId: string;
  sourceId: string;
  paymentIntentId?: string;
  baseCents: number;
  currency: string;
  paidAt: string;
  refundWindowDays: number;
  livemode?: boolean;
}): Commission {
  return {
    id: input.id,
    partnerCode: input.partner.code,
    orderId: input.orderId,
    sourceId: input.sourceId,
    ...(input.paymentIntentId ? { paymentIntentId: input.paymentIntentId } : {}),
    baseCents: input.baseCents,
    refundedCents: 0,
    ratePct: input.partner.ratePct,
    commissionCents: commissionCents(input.baseCents, input.partner.ratePct),
    currency: input.currency || "usd",
    status: "pending",
    createdAt: new Date().toISOString(),
    paidAt: input.paidAt,
    approvableAt: approvableAtIso(input.paidAt, input.refundWindowDays),
    ...(typeof input.livemode === "boolean" ? { livemode: input.livemode } : {}),
  };
}

/** Apply a cumulative refund amount (cents) to a commission. Paid commissions are left for Tony to claw back by hand. */
export function applyRefundToCommission(c: Commission, refundedCentsTotal: number, at = new Date().toISOString()): Commission {
  if (c.status === "paid") return c;
  const refundedCents = Math.min(c.baseCents, Math.max(c.refundedCents, Math.round(refundedCentsTotal)));
  const cents = commissionCents(c.baseCents, c.ratePct, refundedCents);
  const next: Commission = { ...c, refundedCents, commissionCents: cents };
  if (cents === 0) {
    next.status = "void";
    next.voidedAt = next.voidedAt || at;
  }
  return next;
}

/** Status as of `nowMs`: a pending commission past its refund window is approved. */
export function effectiveStatus(c: Commission, nowMs = Date.now()): CommissionStatus {
  if (c.status === "pending" && Date.parse(c.approvableAt) <= nowMs) return "approved";
  return c.status;
}

/** "2026-10" → [start, end) in ms (UTC). */
export function monthRange(month: string): [number, number] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return [Date.UTC(y, mo - 1, 1), Date.UTC(y, mo, 1)];
}

export type PayoutRow = {
  partnerCode: string;
  partnerName: string;
  partnerEmail: string;
  commissions: number;
  baseCents: number;
  refundedCents: number;
  commissionCents: number;
  commissionIds: string[];
};

/**
 * Payout for a month = every unpaid commission that was approved (refund window passed) by the end of that
 * month. Pending, void and already-paid commissions are excluded.
 */
export function payoutRows(commissions: Commission[], partners: PartnerTerms[], month: string): PayoutRow[] {
  const range = monthRange(month);
  if (!range) throw new Error("Month must look like 2026-10.");
  const end = range[1];
  const byCode = new Map(partners.map((p) => [p.code, p]));
  const rows = new Map<string, PayoutRow>();
  for (const c of commissions) {
    if (effectiveStatus(c, end - 1) !== "approved") continue;
    if (c.commissionCents <= 0) continue;
    const partner = byCode.get(c.partnerCode);
    const row =
      rows.get(c.partnerCode) ||
      {
        partnerCode: c.partnerCode,
        partnerName: partner?.name || "",
        partnerEmail: partner?.email || "",
        commissions: 0,
        baseCents: 0,
        refundedCents: 0,
        commissionCents: 0,
        commissionIds: [],
      };
    row.commissions += 1;
    row.baseCents += c.baseCents;
    row.refundedCents += c.refundedCents;
    row.commissionCents += c.commissionCents;
    row.commissionIds.push(c.id);
    rows.set(c.partnerCode, row);
  }
  return [...rows.values()].sort((a, b) => a.partnerCode.localeCompare(b.partnerCode));
}

/** CSV cell: quoted, and spreadsheet formula injection neutralized. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function payoutCsv(rows: PayoutRow[], month: string): string {
  const header = [
    "month",
    "partner_code",
    "partner_name",
    "partner_email",
    "commissions",
    "base_usd",
    "refunded_usd",
    "commission_usd",
    "commission_ids",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        month,
        row.partnerCode,
        row.partnerName,
        row.partnerEmail,
        row.commissions,
        dollars(row.baseCents),
        dollars(row.refundedCents),
        dollars(row.commissionCents),
        row.commissionIds.join(" "),
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
