"use client";

import { useState } from "react";
import type { FlipState } from "@/lib/factory/flip/model";

type Row = { id: string; label: string; stage: string; state: FlipState | null };
const STAGES = ["traffic", "content", "monetization", "data_recording", "buyer_handoff"] as const;
const tone: Record<string, string> = {
  complete: "bg-emerald-500/15 text-emerald-200",
  partial: "bg-amber-500/15 text-amber-200",
  not_started: "bg-white/10 text-slate-300",
};

async function act(body: Record<string, string>) {
  const res = await fetch("/api/factory/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  return json as { ok: boolean; error?: string; projectId?: string; flip?: FlipState };
}

export default function FlipConsole({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, string>, label: string) {
    setBusy(true);
    setMsg(`${label}…`);
    const r = await act(body);
    setBusy(false);
    if (!r.ok || !r.flip) return setMsg(`${label} failed: ${r.error || "unknown error"}`);
    const flip = r.flip;
    setRows((cur) => {
      const found = cur.some((x) => x.id === flip.projectId);
      const row = { id: flip.projectId, label: flip.businessName, stage: flip.closed ? "closed" : "new", state: flip };
      return found ? cur.map((x) => (x.id === flip.projectId ? { ...x, state: flip } : x)) : [row, ...cur];
    });
    setMsg(`${label}: done.`);
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-50" onClick={() => run({ op: "flip-seed-flipradar" }, "Create FlipRadar flip")}>
          New FlipRadar flip
        </button>
        <CreateExisting busy={busy} onRun={run} />
      </div>
      {msg ? <p role="status" className="text-sm text-slate-300">{msg}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No flip projects yet.</p> : null}
      {rows.map((row) => (
        <FlipCard key={row.id} row={row} busy={busy} onRun={run} />
      ))}
    </div>
  );
}

function CreateExisting({ busy, onRun }: { busy: boolean; onRun: (b: Record<string, string>, l: string) => void }) {
  const [id, setId] = useState("");
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (id) onRun({ op: "flip-init", projectId: id.trim() }, "Convert project to flip"); }}>
      <input aria-label="Existing project id" value={id} onChange={(e) => setId(e.target.value)} placeholder="proj_… to convert" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" />
      <button disabled={busy || !id} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-50">Make flip project</button>
    </form>
  );
}

function Field({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-slate-100" />
    </label>
  );
}

function formBody(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const out: Record<string, string> = {};
  new FormData(e.currentTarget).forEach((v, k) => { if (String(v).trim()) out[k] = String(v).trim(); });
  return out;
}

function FlipCard({ row, busy, onRun }: { row: Row; busy: boolean; onRun: (b: Record<string, string>, l: string) => void }) {
  const s = row.state;
  const id = row.id;
  if (!s) {
    return (
      <section className="rounded-xl border border-white/10 p-4">
        <p className="font-semibold">{row.label} <span className="text-xs text-slate-500">{id}</span></p>
        <button disabled={busy} className="mt-2 rounded-lg border border-white/20 px-3 py-1 text-sm" onClick={() => onRun({ op: "flip-init", projectId: id }, "Init flip")}>Initialize flip state</button>
      </section>
    );
  }
  const gen = s.generated || [];
  return (
    <section className="rounded-xl border border-white/10 p-4" data-flip={id}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{s.businessName} {s.test ? <span className="text-amber-300">[TEST]</span> : null} {s.closed ? <span className="text-slate-500">(closed)</span> : null}</h2>
          <p className="text-xs text-slate-400">{id} · {s.domain || "no domain"} · {s.niche} · launch {s.launchDate} · goal {s.goal}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="rounded-lg border border-white/20 px-3 py-1" href={`/api/factory/export?flip=${id}&format=handoff`}>Download handoff package</a>
          <a className="rounded-lg border border-white/20 px-3 py-1" href={`/api/factory/export?flip=${id}&format=sitegrow-json`}>SiteGrow JSON</a>
          <a className="rounded-lg border border-white/20 px-3 py-1" href={`/api/factory/export?flip=${id}&format=sitegrow-csv`}>SiteGrow CSV</a>
        </div>
      </header>

      <ol className="mt-4 grid gap-2 md:grid-cols-5">
        {STAGES.map((key) => {
          const st = s.stages.find((x) => x.key === key);
          return (
            <li key={key} className="rounded-lg border border-white/10 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold capitalize">{key.replace("_", " ")}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${tone[st?.status || "not_started"]}`}>{st?.status || "not_started"}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{st?.summary || "Not run yet."}</p>
              {st?.needs?.length ? <ul className="mt-1 list-disc pl-4 text-xs text-amber-200">{st.needs.map((n) => <li key={n}>{n}</li>)}</ul> : null}
              <button disabled={busy} className="mt-2 rounded-md border border-white/20 px-2 py-1 text-xs disabled:opacity-50" onClick={() => onRun({ op: "flip-run-stage", projectId: id, stage: key }, `Run ${key}`)}>Run stage</button>
            </li>
          );
        })}
      </ol>
      <button disabled={busy} className="mt-2 rounded-lg bg-brand-500 px-3 py-1 text-sm font-semibold text-black disabled:opacity-50" onClick={() => onRun({ op: "flip-run-stage", projectId: id, stage: "all" }, "Run all stages")}>Run all stages</button>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <form className="space-y-2" onSubmit={(e) => onRun({ op: "flip-set-analytics", projectId: id, ...formBody(e) }, "Save analytics & ads")}>
          <h3 className="font-semibold">Analytics & ads</h3>
          <Field name="ga4MeasurementId" label="GA4 measurement ID" defaultValue={s.analytics.ga4MeasurementId} placeholder="G-XXXXXXX" />
          <Field name="gscProperty" label="Search Console property" defaultValue={s.analytics.gscProperty} placeholder="sc-domain:example.com" />
          <Field name="adsensePublisherId" label="AdSense publisher ID" defaultValue={s.adsensePublisherId} placeholder="ca-pub-…" />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <select name="adsenseApproved" defaultValue={s.adsenseApproved ? "true" : "false"} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-slate-100">
              <option value="false">Not approved (ads off)</option>
              <option value="true">Approved by AdSense</option>
            </select>
          </label>
          {s.monetization?.adSlots?.adsTxt ? <p className="text-xs text-slate-400">ads.txt: <code>{s.monetization.adSlots.adsTxt}</code></p> : null}
          <button disabled={busy} className="rounded-md border border-white/20 px-3 py-1 text-sm">Save</button>
        </form>

        <div className="space-y-2">
          <h3 className="font-semibold">Affiliate links</h3>
          {!s.monetization ? <p className="text-xs text-slate-500">Run the monetization stage to list programs.</p> : null}
          {s.monetization?.programs.map((p) => (
            <form key={p.slug} className="flex flex-wrap items-end gap-2" onSubmit={(e) => onRun({ op: "flip-set-affiliate", projectId: id, slug: p.slug, ...formBody(e) }, `Save ${p.name}`)}>
              <span className="w-28 text-sm">{p.name}<br /><span className="text-xs text-slate-500">{p.payout}</span></span>
              <select name="status" defaultValue={p.status} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs">
                <option value="apply">apply</option><option value="pending">pending</option><option value="active">active</option>
              </select>
              <input name="trackingTemplate" defaultValue={p.trackingTemplate || ""} placeholder="https://…{url}" aria-label={`${p.name} tracking link`} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs" />
              <button disabled={busy} className="rounded-md border border-white/20 px-2 py-1 text-xs">Save</button>
            </form>
          ))}
        </div>

        <form className="space-y-2" onSubmit={(e) => onRun({ op: "flip-add-ledger", projectId: id, ...formBody(e) }, "Add ledger row")}>
          <h3 className="font-semibold">Revenue ledger</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field name="date" label="Date" placeholder="YYYY-MM-DD" />
            <label className="flex flex-col gap-1 text-xs text-slate-400">Type
              <select name="type" className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-slate-100"><option>revenue</option><option>expense</option></select>
            </label>
            <Field name="source" label="Source" placeholder="AdSense, Kiavi, hosting…" />
            <Field name="amount" label="Amount (USD)" placeholder="0.00" />
            <Field name="proof" label="Proof (file/link)" />
            <Field name="note" label="Note" />
          </div>
          <button disabled={busy} className="rounded-md border border-white/20 px-3 py-1 text-sm">Add row</button>
          <p className="text-xs text-slate-500">{s.records.ledger.length} rows.</p>
        </form>

        <form className="space-y-2" onSubmit={(e) => onRun({ op: "flip-record-snapshot", projectId: id, ...formBody(e) }, "Save snapshot")}>
          <h3 className="font-semibold">Monthly snapshot</h3>
          <div className="grid grid-cols-3 gap-2">
            <Field name="month" label="Month" placeholder="YYYY-MM" />
            <Field name="sessions" label="Sessions" />
            <Field name="users" label="Users" />
            <Field name="pageviews" label="Pageviews" />
            <Field name="gscClicks" label="GSC clicks" />
            <Field name="gscImpressions" label="GSC impressions" />
          </div>
          <button disabled={busy} className="rounded-md border border-white/20 px-3 py-1 text-sm">Save snapshot</button>
          <table className="mt-2 w-full text-xs text-slate-300">
            <thead><tr className="text-left text-slate-500"><th>Month</th><th>Sessions</th><th>GSC clicks</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead>
            <tbody>{s.records.snapshots.map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.sessions ?? "–"}</td><td>{m.gscClicks ?? "–"}</td><td>{m.revenue}</td><td>{m.expenses}</td><td>{m.profit}</td></tr>)}</tbody>
          </table>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold">Generated drafts ({gen.length})</h3>
        <p className="text-xs text-slate-500">Written by the factory LLM. Drafts only: nothing is published.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {gen.map((g) => (
            <li key={`${g.kind}:${g.slug}`} className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-white/10 px-1.5 text-xs">{g.kind}</span>
              <span>{g.title}</span>
              <span className="text-xs text-slate-400">{g.words} words · {g.model}</span>
              <span className={`rounded-full px-2 text-xs ${g.status === "pending_approval" ? tone.complete : tone.partial}`}>{g.status}{g.leaks.length ? ` (${g.leaks.join(", ")})` : ""}</span>
              {"approvedAt" in g && g.approvedAt ? <span className="text-xs text-emerald-300">approved</span> : g.status === "pending_approval" ? (
                <button disabled={busy} className="rounded-md border border-white/20 px-2 text-xs" onClick={() => onRun({ op: "flip-approve-page", projectId: id, slug: g.slug, kind: g.kind }, `Approve ${g.slug}`)}>Approve</button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {!s.closed ? (
        <button disabled={busy} className="mt-6 text-xs text-slate-500 underline" onClick={() => { if (confirm("Close this flip project?")) onRun({ op: "flip-close", projectId: id }, "Close"); }}>Close project</button>
      ) : null}
    </section>
  );
}
