"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Durable recovery for a requested baseline recapture.
 * The server decides (from persisted status) that a recapture is still owed - stale, a request newer than the
 * last capture, or a "pending" run that never finished. This runs it once per page load and refreshes.
 */
export default function BaselineAutoRecapture({
  projectId,
  needed,
  reason,
}: {
  projectId: string;
  needed: boolean;
  reason?: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!needed || started.current) return;
    started.current = true;
    setState("running");
    (async () => {
      try {
        const res = await fetch("/api/factory/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "recapture-client-baseline",
            projectId,
            hostOrigin: window.location.origin,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || `Recapture failed (${res.status})`);
        setState("done");
        setMessage("Baseline recaptured.");
        router.refresh();
      } catch (err) {
        setState("failed");
        setMessage(err instanceof Error ? err.message : "Recapture failed");
        router.refresh();
      }
    })();
  }, [needed, projectId, router]);

  if (!needed && state === "idle") return null;
  return (
    <p
      className={`mt-3 text-xs ${state === "failed" ? "text-rose-300" : "text-amber-200"}`}
      role="status"
      aria-live="polite"
    >
      {state === "running"
        ? `Baseline recapture pending - running now${reason ? ` (${reason})` : ""}...`
        : message || "Baseline recapture pending."}
    </p>
  );
}
