"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { trackLead } from "@/lib/analytics";

type Status = "idle" | "loading" | "success" | "error";

/** /giveaway entry form: first name + email + business name -> /api/giveaway. Free entry. */
export default function GiveawayEntryForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
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
      const res = await fetch("/api/giveaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          businessName: businessName.trim(),
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
      trackLead("giveaway_entry", { source: "giveaway-2026" });
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
          {duplicate ? "You're already entered." : "You're entered."}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {warning
            ? "Your entry is saved. The confirmation email could not send just yet — the winner is notified by email after the draw, so keep an eye on your inbox."
            : "Your confirmation is on its way to your inbox. The winner is drawn Friday, November 27, 2026 and notified by email."}
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Your free starter checklist is in the confirmation email too.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400";

  return (
    <form
      method="post"
      action="/api/giveaway"
      onSubmit={handleSubmit}
      className="mx-auto mt-8 flex max-w-md flex-col gap-3"
    >
      <label className="sr-only" htmlFor="giveaway-name">
        First name
      </label>
      <input
        id="giveaway-name"
        type="text"
        name="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="First name"
        autoComplete="given-name"
        className={inputClass}
      />
      <label className="sr-only" htmlFor="giveaway-email">
        Email address
      </label>
      <input
        id="giveaway-email"
        type="email"
        name="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        autoComplete="email"
        className={inputClass}
      />
      <label className="sr-only" htmlFor="giveaway-business-name">
        Business name
      </label>
      <input
        id="giveaway-business-name"
        type="text"
        name="businessName"
        required
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Business name"
        autoComplete="organization"
        className={inputClass}
      />
      <label className="sr-only" htmlFor="giveaway-business-kind">
        What kind of business is it? (optional)
      </label>
      <input
        id="giveaway-business-kind"
        type="text"
        name="businessKind"
        value={businessKind}
        onChange={(e) => setBusinessKind(e.target.value)}
        placeholder="What kind of business is it? (optional)"
        autoComplete="off"
        className={inputClass}
      />
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="giveaway-company_website">Company website</label>
        <input
          id="giveaway-company_website"
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
        {status === "loading" ? "Entering..." : "Enter free"}
      </button>
      {status === "error" && <p className="text-sm text-red-400">{errorMessage}</p>}
      <p className="text-left text-xs leading-relaxed text-slate-400">
        Free entry — no purchase necessary, and buying anything does not improve your chances.
        We&apos;ll email your entry confirmation and occasional SitesInc tips and offers.
        Unsubscribe anytime. No spam, no selling your address — see our{" "}
        <Link href="/privacy" className="font-medium text-brand-300 hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
