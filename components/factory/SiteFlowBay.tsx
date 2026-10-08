"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiteFlowSummary } from "@/lib/siteflow/summary";

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function when(iso?: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "never";
}

const box = "rounded-xl border border-white/10 px-3 py-2";
const btn = "rounded-lg border border-white/15 px-2.5 py-1 text-xs text-slate-100 hover:border-brand-400/50 disabled:opacity-50";
const input = "rounded-lg bg-black/40 px-2 py-1 text-sm text-white ring-1 ring-white/10";

export default function SiteFlowBay({ summary, origin }: { summary: SiteFlowSummary; origin: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [partner, setPartner] = useState({ code: "", name: "", email: "", ratePct: "", recurringPayments: "0" });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  async function act(op: string, payload: Record<string, unknown> = {}) {
    setBusy(op + String(payload.orderId || payload.code || ""));
    setMessage("");
    try {
      const res = await fetch("/api/factory/siteflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string; link?: string; approved?: number; marked?: number };
      if ((!res.ok && res.status !== 202) || data.ok === false) throw new Error(data.error || "Action failed");
      setMessage(
        data.link
          ? `Partner added. Link: ${data.link}`
          : data.message ||
              (typeof data.approved === "number" ? `${data.approved} commission(s) approved.` : "") ||
              (typeof data.marked === "number" ? `${data.marked} commission(s) marked paid.` : "Done.")
      );
      if (op === "add-partner") setPartner({ code: "", name: "", email: "", ratePct: "", recurringPayments: "0" });
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function upload(slug: string, file: File | undefined) {
    if (!file) return;
    setBusy(`upload${slug}`);
    setMessage("");
    try {
      const form = new FormData();
      form.set("slug", slug);
      form.set("file", file);
      const res = await fetch("/api/factory/siteflow/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string; bytes?: number };
      if (!res.ok || !data.ok) throw new Error(data.error || "Upload failed");
      setMessage(`Uploaded ${data.bytes} bytes for ${slug}.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy("");
    }
  }

  const syncBySlug = new Map((summary.stripeStatus?.items || []).map((i) => [i.slug, i]));

  return (
    <section className="mt-10 rounded-2xl border border-brand-400/30 bg-white/5 p-5" id="siteflow-bay">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Factory bay</p>
          <h2 className="mt-1 text-xl font-semibold">SiteFlow · monetization</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Catalog → Stripe Checkout → verified webhook → paid order → automatic fulfillment (signed download links by
            email) → partner commissions approved after a {summary.refundWindowDays}-day refund window → manual monthly
            payout CSV. Ref cookie window {summary.refWindowDays} days. Outbound partner links go through /go with click logging.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${summary.stripeMode === "live" ? "bg-rose-500/20 text-rose-200" : summary.stripeMode === "test" ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
            Stripe: {summary.stripeMode}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${summary.webhookSecretSet ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
            webhook secret {summary.webhookSecretSet ? "set" : "missing"}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${summary.downloadSigningSet ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
            download signing {summary.downloadSigningSet ? "set" : "not set (local dev fallback only)"}
          </span>
        </div>
      </div>

      {message ? <p className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">{message}</p> : null}
      {summary.errors.length ? <p className="mt-3 text-sm text-amber-200">Unavailable: {summary.errors.join(" · ")}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className={box}>
          <p className="text-xs text-slate-400">Webhook last seen</p>
          <p className="mt-1 text-sm font-semibold text-white">{when(summary.webhook?.at)}</p>
          <p className="text-xs text-slate-500">
            {summary.webhook?.type ? `${summary.webhook.type} · ${summary.webhook.livemode ? "live" : "test"}` : "no verified event yet"}
          </p>
          {summary.webhook?.lastRejectedAt ? (
            <p className="text-xs text-amber-300">Rejected {when(summary.webhook.lastRejectedAt)}: {summary.webhook.lastRejectReason}</p>
          ) : null}
        </div>
        <div className={box}>
          <p className="text-xs text-slate-400">Revenue (test mode)</p>
          <p className="mt-1 text-lg font-semibold text-white">{money(summary.revenue.testCents - summary.revenue.refundsTestCents)}</p>
          <p className="text-xs text-slate-500">gross {money(summary.revenue.testCents)} · refunds {money(summary.revenue.refundsTestCents)}</p>
        </div>
        <div className={box}>
          <p className="text-xs text-slate-400">Revenue (live mode)</p>
          <p className="mt-1 text-lg font-semibold text-white">{money(summary.revenue.liveCents - summary.revenue.refundsLiveCents)}</p>
          <p className="text-xs text-slate-500">gross {money(summary.revenue.liveCents)} · refunds {money(summary.revenue.refundsLiveCents)}</p>
        </div>
        <div className={box}>
          <p className="text-xs text-slate-400">Orders by status</p>
          <p className="mt-1 text-xs text-slate-200">
            {Object.entries(summary.ordersByStatus).map(([s, n]) => `${s} ${n}`).join(" · ") || "no orders yet"}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Catalog &amp; Stripe sync</h3>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            {summary.stripeStatus
              ? `checked ${when(summary.stripeStatus.checkedAt)} (${summary.stripeStatus.source}, ${summary.stripeStatus.mode})`
              : "never checked"}
            {summary.stripeStatus?.error ? ` · ${summary.stripeStatus.error}` : ""}
          </span>
          <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => act("check-stripe")}>
            {busy === "check-stripe" ? "Checking…" : "Check Stripe (read-only)"}
          </button>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 pr-2">Product</th>
              <th className="pr-2">Kind</th>
              <th className="pr-2">Public</th>
              <th className="pr-2">Price</th>
              <th className="pr-2">Lookup key</th>
              <th className="pr-2">Stripe</th>
              <th className="pr-2">Deliverable</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {summary.catalog.map((c) => {
              const sync = syncBySlug.get(c.slug);
              return (
                <tr key={c.slug} className="border-t border-white/5 align-top">
                  <td className="py-1 pr-2">{c.name}{c.retired ? " (retired)" : ""}</td>
                  <td className="pr-2">{c.kind}</td>
                  <td className="pr-2">{c.listed ? "listed" : "hidden"}</td>
                  <td className="pr-2">{c.price || <span className="text-amber-300">needs Tony</span>}</td>
                  <td className="pr-2 font-mono text-[11px]">{c.lookupKey || "—"}</td>
                  <td className="pr-2">{c.lookupKey ? sync?.state || "unchecked" : "—"}</td>
                  <td className="pr-2">
                    {c.deliverable}
                    {c.fileUploaded === false ? (
                      <label className="ml-2 cursor-pointer text-amber-300">
                        not uploaded · upload
                        <input type="file" className="hidden" disabled={Boolean(busy)} onChange={(e) => upload(c.slug, e.target.files?.[0])} />
                      </label>
                    ) : c.fileUploaded ? (
                      <span className="ml-2 text-emerald-300">uploaded</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {summary.failures.length ? (
        <>
          <h3 className="mt-6 text-sm font-semibold text-amber-200">Fulfillment failures</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {summary.failures.map((f) => (
              <li key={f.orderId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/30 px-3 py-2">
                <span className="text-slate-200">
                  <span className="font-mono">{f.orderId}</span> · {f.stage} · {f.attempts} attempt(s) · {when(f.at)} · {f.error}
                </span>
                <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => act("retry-fulfillment", { orderId: f.orderId })}>
                  {busy === `retry-fulfillment${f.orderId}` ? "Starting…" : "Retry"}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {summary.manualTodo.length ? (
        <>
          <h3 className="mt-6 text-sm font-semibold text-white">Needs manual setup</h3>
          <ul className="mt-2 space-y-1 text-xs">
            {summary.manualTodo.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2">
                <span className="text-slate-200"><span className="font-mono">{o.id}</span> · {o.items} · paid {when(o.paidAt)}</span>
                <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => act("mark-fulfilled", { orderId: o.id })}>Mark done</button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold text-white">Recent orders</h3>
      {summary.recentOrders.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 pr-2">Order</th>
                <th className="pr-2">Status</th>
                <th className="pr-2">Items</th>
                <th className="pr-2">Total</th>
                <th className="pr-2">Fulfillment</th>
                <th className="pr-2">Ref</th>
                <th />
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {summary.recentOrders.map((o) => (
                <tr key={o.id} className="border-t border-white/5">
                  <td className="py-1 pr-2 font-mono">{o.id}{o.livemode === false ? " (test)" : ""}</td>
                  <td className="pr-2">{o.status}{o.subscriptionStatus === "canceled" ? " · sub canceled" : ""}</td>
                  <td className="pr-2">{o.items}</td>
                  <td className="pr-2">${o.subtotal.toFixed(2)}</td>
                  <td className="pr-2">{o.fulfillment}</td>
                  <td className="pr-2">{o.ref ? `${o.ref}${o.refRejected ? ` (${o.refRejected})` : ""}` : "—"}</td>
                  <td>
                    {o.status === "paid" || o.status === "fulfilled" || o.status === "failed" ? (
                      <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => act("retry-fulfillment", { orderId: o.id })}>
                        {o.status === "fulfilled" ? "Resend" : "Retry"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No orders yet.</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Partners (in-house referrals)</h3>
          {summary.partners.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {summary.partners.map((p) => (
                <li key={p.code} className="rounded-lg border border-white/10 px-3 py-2 text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">{p.name}</span> · {p.code} · {p.ratePct}%
                      {p.recurringPayments > 1 ? ` · first ${p.recurringPayments} payments` : " · first payment only"} · {p.status}
                    </span>
                    <button
                      type="button"
                      className={btn}
                      disabled={Boolean(busy)}
                      onClick={() => act("set-partner-status", { code: p.code, status: p.status === "active" ? "paused" : "active" })}
                    >
                      {p.status === "active" ? "Pause" : "Activate"}
                    </button>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{`${origin}/?ref=${p.code}`}</p>
                  <p className="text-slate-400">
                    orders {p.orders} · pending {money(p.pendingCents)} · approved {money(p.approvedCents)} · paid {money(p.paidCents)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No partners yet.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className={`${input} w-28`} placeholder="code" value={partner.code} onChange={(e) => setPartner({ ...partner, code: e.target.value })} />
            <input className={`${input} w-36`} placeholder="name" value={partner.name} onChange={(e) => setPartner({ ...partner, name: e.target.value })} />
            <input className={`${input} w-48`} placeholder="payout email" value={partner.email} onChange={(e) => setPartner({ ...partner, email: e.target.value })} />
            <input className={`${input} w-20`} placeholder="rate %" inputMode="decimal" value={partner.ratePct} onChange={(e) => setPartner({ ...partner, ratePct: e.target.value })} />
            <label className="flex items-center gap-1 text-xs text-slate-400">
              subscription payments that earn
              <input className={`${input} w-14`} inputMode="numeric" value={partner.recurringPayments} onChange={(e) => setPartner({ ...partner, recurringPayments: e.target.value })} />
            </label>
            <button
              type="button"
              className={btn}
              disabled={Boolean(busy)}
              onClick={() => act("add-partner", { ...partner, ratePct: Number(partner.ratePct), recurringPayments: Number(partner.recurringPayments) })}
            >
              Add partner + get link
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Commissions</h3>
          <p className="mt-2 text-xs text-slate-300">
            pending {money(summary.commissions.pendingCents)} ({summary.commissions.pendingCount}) · approved, unpaid{" "}
            {money(summary.commissions.approvedCents)} ({summary.commissions.approvedCount}) · paid {money(summary.commissions.paidCents)} · void{" "}
            {summary.commissions.voidCount}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => act("approve-due")}>
              Approve commissions past refund window
            </button>
            <input className={`${input} w-28`} value={month} onChange={(e) => setMonth(e.target.value)} placeholder="2026-10" />
            <a className={btn} href={`/api/factory/siteflow/payouts?month=${encodeURIComponent(month)}`}>
              Payout CSV
            </a>
            <button
              type="button"
              className={btn}
              disabled={Boolean(busy)}
              onClick={() => {
                if (window.confirm(`Mark every commission in the ${month} payout CSV as paid? Only do this after you have actually paid the partners.`)) {
                  void act("mark-payout-paid", { month });
                }
              }}
            >
              Mark {month} payout paid
            </button>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-white">Outbound partner clicks</h3>
          <p className="mt-2 text-xs text-slate-300">
            {summary.clicks.total} total · {summary.clicks.last30} in 30 days · {summary.clicks.tracked} with a program id
          </p>
          <p className="text-xs text-slate-400">
            {Object.entries(summary.clicks.bySlug).map(([s, n]) => `${s} ${n}`).join(" · ") || "no clicks yet"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Programs: {summary.programs.map((p) => `${p.name} ${p.tracked ? "tracked" : "plain link"}`).join(" · ")} · /tools{" "}
            {summary.toolsPageListed ? "listed" : "unlisted"}
          </p>
        </div>
      </div>
    </section>
  );
}
