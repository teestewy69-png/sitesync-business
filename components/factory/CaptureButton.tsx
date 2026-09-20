"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CaptureButton({ origin }: { origin: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function capture() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/factory/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Capture failed");
      setMessage(`Saved ${data.id}`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={capture}
        className="rounded-lg bg-gradient-to-b from-brand-300 to-brand-600 px-3 py-1.5 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {busy ? "Crawling live site…" : "Capture dated baseline"}
      </button>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
