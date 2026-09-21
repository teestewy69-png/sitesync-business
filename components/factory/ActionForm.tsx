"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActionForm({
  op,
  fields = {},
  label,
  tone = "brand",
}: {
  op: string;
  fields?: Record<string, string>;
  label: string;
  tone?: "brand" | "muted" | "danger";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cls =
    tone === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20"
      : tone === "muted"
        ? "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
        : "bg-gradient-to-b from-brand-300 to-brand-600 text-zinc-950 hover:from-brand-200";

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/factory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...fields }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Action failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${cls}`}
      >
        {busy ? "Working…" : label}
      </button>
      {error ? <p className="max-w-xs text-xs text-amber-200">{error}</p> : null}
    </div>
  );
}
