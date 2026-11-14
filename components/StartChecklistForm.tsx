"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { trackLead } from "@/lib/analytics";

type Status = "idle" | "loading" | "success" | "error";

/** /start lead-magnet form: first name + email (+ optional business kind) -> /api/lead-magnet. */
export default function StartChecklistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessKind, setBusinessKind] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [warning, setWarning] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status === "success") return;
    submitting.current = true;
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          businessKind: businessKind.trim() || undefined,
          company_website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setWarning(Boolean(data?.warning));
      setDuplicate(Boolean(data?.duplicate));
      setStatus("success");
      trackLead("checklist_signup", { source: "lead-magnet-start" });
    } catch (err) {
      submitting.current = false;
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-xl bg-brand-500/10 px-5 py-5 text-center ring-1 ring-brand-500/25">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-brand-200">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {duplicate ? "You're already on the list." : "You're in."}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {warning
            ? "The email could not send just yet, but no need to wait — the checklist is right here:"
            : "The checklist is on its way to your inbox. Want it right now instead?"}
        </p>
        <Link
          href="/start/checklist"
          className="mt-4 inline-flex rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
        >
          Read the checklist
        </Link>
        <p className="mt-3 text-xs text-slate-400">
          A PDF copy is in the email too, so you can save or print it.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400";

  return (
    <form
      method="post"
      action="/api/lead-magnet"
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex max-w-md flex-col gap-3"
    >
      <label className="sr-only" htmlFor="start-name">
        First name
      </label>
      <input
        id="start-name"
        type="text"
        name="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="First name"
        autoComplete="given-name"
        className={inputClass}
      />
      <label className="sr-only" htmlFor="start-email">
        Email address
      </label>
      <input
        id="start-email"
        type="email"
        name="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        autoComplete="email"
        className={inputClass}
      />
      <label className="sr-only" htmlFor="start-business-kind">
        What kind of business are you starting? (optional)
      </label>
      <input
        id="start-business-kind"
        type="text"
        name="businessKind"
        value={businessKind}
        onChange={(e) => setBusinessKind(e.target.value)}
        placeholder="What kind of business are you starting? (optional)"
        autoComplete="off"
        className={inputClass}
      />
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="start-company_website">Company website</label>
        <input
          id="start-company_website"
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Sending..." : "Send me the free checklist"}
      </button>
      {status === "error" && <p className="text-sm text-red-400">{errorMessage}</p>}
      <p className="text-left text-xs leading-relaxed text-slate-400">
        We&apos;ll send the checklist and occasional SitesInc tips and offers. Unsubscribe anytime.
        No spam, no selling your address — see our{" "}
        <Link href="/privacy" className="font-medium text-brand-300 hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
