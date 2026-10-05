"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CaptureButton({
  origin,
  siteId,
  projectId,
  label,
}: {
  origin: string;
  siteId?: string;
  /** When set, baseline is bound to the per-client workspace (never Sitesinc). */
  projectId?: string;
  label?: string;
}) {
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
        body: JSON.stringify({
          origin,
          siteId,
          projectId: projectId || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
        pages?: number;
        pagesOk?: number;
        limited?: boolean;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Capture failed");
      const pagesBit =
        typeof data.pagesOk === "number"
          ? ` · ${data.pagesOk}/${data.pages ?? "?"} pages OK`
          : data.pages != null
            ? ` · ${data.pages} pages`
            : "";
      setMessage(
        data.limited
          ? `Saved ${data.id}${pagesBit} (limited — preview thin or unreachable)`
          : `Saved ${data.id}${pagesBit}`
      );
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
        {busy ? "Crawling…" : label || "Capture dated baseline"}
      </button>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
