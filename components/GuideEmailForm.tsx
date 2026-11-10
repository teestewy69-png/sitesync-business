"use client";

import { FormEvent, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import content from "@/content.json";
import { trackLead } from "@/lib/analytics";
import { GUIDE_OFFER_ID, GUIDE_TITLE } from "@/lib/lead-guide";

type Status = "idle" | "loading" | "success" | "error";

/**
 * "Email me the guide" form on /free-guide. Same /api/subscribe contract as EmailCapture and the
 * exit-intent pop-up (honeypot, Idempotency-Key, required privacy consent) with offer=GUIDE_OFFER_ID,
 * so the lead is saved in the same place and the guide email goes out instead of the build-request email.
 */
export default function GuideEmailForm({ source }: { source: string }) {
  const { emailCapture } = content;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const key = useRef("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading" || status === "success") return;
    if (!key.current) {
      key.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key.current },
        body: JSON.stringify({
          name,
          email,
          privacy,
          monitoring: false,
          offer: GUIDE_OFFER_ID,
          details: `Free guide request (${source}): ${GUIDE_TITLE}`,
          company_website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
      setMessage(
        data?.warning
          ? "Saved. The email couldn't send right now, but you can download the checklist on this page."
          : "Done. The guide is on its way to your inbox."
      );
      setStatus("success");
      trackLead("free_guide_request", { source });
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-500/10 px-5 py-4 text-sm font-medium text-brand-200 ring-1 ring-brand-500/25">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        {message}
      </div>
    );
  }

  return (
    <form method="post" action="/api/subscribe" onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="offer" value={GUIDE_OFFER_ID} />
      <label className="sr-only" htmlFor={`guide-${source}-name`}>Your name</label>
      <input
        id={`guide-${source}-name`}
        type="text"
        name="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={emailCapture.namePlaceholder}
        autoComplete="name"
        className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <label className="sr-only" htmlFor={`guide-${source}-email`}>Email address</label>
      <input
        id={`guide-${source}-email`}
        type="email"
        name="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={emailCapture.placeholder}
        autoComplete="email"
        className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={`guide-${source}-company_website`}>Company website</label>
        <input
          id={`guide-${source}-company_website`}
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-left text-sm text-slate-400">
        <input
          type="checkbox"
          name="privacy"
          required
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          className="mt-1"
        />
        <span>
          I agree to the{" "}
          <a href="/privacy" className="font-medium text-brand-300 hover:underline">
            privacy policy
          </a>{" "}
          so you can email me the guide.
        </span>
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Sending..." : "Email me the free guide"}
      </button>
      {status === "error" ? <p className="text-sm text-red-400">{message}</p> : null}
    </form>
  );
}
