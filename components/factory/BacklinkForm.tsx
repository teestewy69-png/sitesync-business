"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BacklinkForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/factory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "add-backlink",
          referringDomain: String(data.get("referringDomain") || ""),
          destinationUrl: String(data.get("destinationUrl") || ""),
          anchor: String(data.get("anchor") || ""),
          relevance: String(data.get("relevance") || ""),
          qualityNotes: String(data.get("qualityNotes") || ""),
          acquisitionMethod: String(data.get("acquisitionMethod") || "earned / manual"),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not record backlink.");
      setOk("Recorded. Only live, relevant links belong here.");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record backlink.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-2 rounded-xl border border-white/10 p-4 md:grid-cols-2">
      <p className="md:col-span-2 text-sm text-slate-400">
        Add a backlink only after it is live on the referring domain. Do not invent rows to look busy.
      </p>
      <input
        name="referringDomain"
        required
        placeholder="Referring domain"
        className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <input
        name="destinationUrl"
        required
        type="url"
        placeholder="Destination URL"
        className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <input
        name="anchor"
        placeholder="Anchor"
        className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <input
        name="relevance"
        placeholder="Relevance"
        className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <input
        name="acquisitionMethod"
        placeholder="How it was earned"
        className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <input
        name="qualityNotes"
        placeholder="Quality notes"
        className="rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Record live backlink"}
        </button>
        {error ? <p className="text-xs text-amber-200">{error}</p> : null}
        {ok ? <p className="text-xs text-emerald-200">{ok}</p> : null}
      </div>
    </form>
  );
}
