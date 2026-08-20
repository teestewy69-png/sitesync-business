"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import content from "@/content.json";

type Status = "idle" | "loading" | "success" | "error";

/**
 * Newsletter / lead-magnet signup. Posts to /api/subscribe, which emails the
 * checklist to the subscriber and a notification to us via Titan SMTP.
 */
export default function EmailCapture() {
  const { emailCapture, footer } = content;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  }

  return (
    <section id="checklist" className="relative border-t border-white/5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/25">
          <Mail className="h-5 w-5" />
        </span>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-brand-300">
          {emailCapture.overline}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {emailCapture.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-400">
          {emailCapture.subtitle}
        </p>

        {status === "success" ? (
          <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-xl bg-brand-500/10 px-5 py-4 text-sm font-medium text-brand-200 ring-1 ring-brand-500/25">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Checklist sent! Check your inbox (and spam folder, just in case).
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailCapture.placeholder}
              aria-label="Email address"
              className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="shrink-0 rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Sending..." : emailCapture.buttonLabel}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="mx-auto mt-3 max-w-md text-sm text-red-400">
            {errorMessage}
          </p>
        )}

        <p className="mx-auto mt-5 max-w-md text-sm text-slate-400">
          {emailCapture.finePrint}{" "}
          <a
            href={`mailto:${footer.email}`}
            className="font-medium text-brand-300 hover:underline"
          >
            {footer.email}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
