"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTION_SURFACES } from "@/lib/factory/surfaces";

export default function ProductionReleaseForm({ selected }: { selected: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const surfaces = data.getAll("surfaces").map(String);
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/factory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "select-production-surfaces",
          approvedBy: "operator",
          surfaces,
          notes: "Intent recorded. Netlify production deploy is a separate step.",
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not save surfaces.");
      setOk("Saved. Nothing is live on sitesinc.co yet.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save surfaces.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl border border-white/10 p-5">
      <p className="text-sm text-slate-400">
        Production is a separate approval. Staging can pass without any of this going public. The
        homepage cannot be replaced from here.
      </p>
      {PRODUCTION_SURFACES.map((surface) => (
        <label key={surface.id} className="flex items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            name="surfaces"
            value={surface.id}
            defaultChecked={selected.includes(surface.id)}
            disabled={surface.id === "homepage"}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{surface.label}</span>
            <span className="block text-slate-400">{surface.note}</span>
          </span>
        </label>
      ))}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save production intent (do not deploy)"}
      </button>
      {error ? <p className="text-xs text-amber-200">{error}</p> : null}
      {ok ? <p className="text-xs text-emerald-200">{ok}</p> : null}
    </form>
  );
}
