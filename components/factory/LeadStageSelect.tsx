"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STAGES, stageLabel, type LeadStage } from "@/lib/lead-stage";

export default function LeadStageSelect({
  id,
  stage,
  who,
}: {
  id: string;
  stage: LeadStage;
  who: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<LeadStage>(stage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const selectId = `stage-${id}`;

  async function change(next: LeadStage) {
    const previous = value;
    setValue(next);
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const res = await fetch(`/api/factory/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not save stage");
      setMessage(`Saved: ${stageLabel(next)}`);
      router.refresh();
    } catch (err) {
      setValue(previous);
      setFailed(true);
      setMessage(err instanceof Error ? err.message : "Could not save stage");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Stage<span className="sr-only"> for {who}</span>
      </label>
      <select
        id={selectId}
        value={value}
        disabled={busy}
        onChange={(event) => void change(event.target.value as LeadStage)}
        className="rounded-lg bg-black/40 px-3 py-1.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
      >
        {LEAD_STAGES.map((option) => (
          <option key={option} value={option}>
            {stageLabel(option)}
          </option>
        ))}
      </select>
      <span role="status" aria-live="polite" className={`text-xs ${failed ? "text-amber-200" : "text-slate-400"}`}>
        {message}
      </span>
    </div>
  );
}
