"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ScreenshotUpload() {
  const router = useRouter();
  const [label, setLabel] = useState("Homepage desktop");
  const [viewport, setViewport] = useState("desktop");
  const [error, setError] = useState("");

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10"
      />
      <select
        value={viewport}
        onChange={(e) => setViewport(e.target.value)}
        className="rounded-lg bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10"
      >
        <option value="desktop">desktop</option>
        <option value="mobile">mobile</option>
      </select>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError("");
          const form = new FormData();
          form.append("file", file);
          form.append("viewport", viewport);
          form.append("label", label);
          const res = await fetch("/api/factory/screenshots", { method: "POST", body: form });
          const data = (await res.json()) as { ok?: boolean; error?: string };
          if (!data.ok) {
            setError(data.error || "Upload failed");
            return;
          }
          router.refresh();
        }}
      />
      {error ? <p className="text-xs text-amber-200">{error}</p> : null}
    </div>
  );
}
