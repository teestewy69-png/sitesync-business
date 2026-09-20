"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import content from "@/content.json";

type Status = "idle" | "loading" | "success" | "error";

export default function EmailCapture() {
  const { emailCapture, footer } = content;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          privacy,
          monitoring,
          company_website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setSuccessMessage(
        data?.warning
          ? "Request saved — this is not a purchase. We have your name and email internally. The confirmation email could not send yet."
          : "Request received. This is not a purchase. If we accept the project, you will get a $997.50 start invoice by email."
      );
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
            {successMessage}
          </div>
        ) : (
          <form
            method="post"
            action="/api/subscribe"
            onSubmit={handleSubmit}
            className="mx-auto mt-8 flex max-w-md flex-col gap-3"
          >
            <label className="sr-only" htmlFor="intake-name">
              Your name
            </label>
            <input
              id="intake-name"
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={emailCapture.namePlaceholder}
              autoComplete="name"
              className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <label className="sr-only" htmlFor="intake-email">
              Email address
            </label>
            <input
              id="intake-email"
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
              <label htmlFor="company_website">Company website</label>
              <input
                id="company_website"
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
                name="monitoring"
                checked={monitoring}
                onChange={(e) => setMonitoring(e.target.checked)}
                className="mt-1"
              />
              <span>{emailCapture.monitoringLabel}</span>
            </label>
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
                {emailCapture.privacyLabel}{" "}
                <a href="/privacy" className="font-medium text-brand-300 hover:underline">
                  Privacy policy
                </a>
                .
              </span>
            </label>
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? "Saving..." : emailCapture.buttonLabel}
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
