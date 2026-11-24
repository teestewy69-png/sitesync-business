"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Free audit capture form (founder ruling 2026-11-23): the audit is NOT run
 * on the spot. The visitor leaves a website address + email; the request
 * route saves the lead and answers at once, then this form fires the /send
 * call (fire-and-forget) so the deep audit and the results email run in
 * their own invocation.
 */
export default function AuditCaptureForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/free-website-audit/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          url: url.trim(),
          privacy,
          company_website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      if (data.id) {
        // Fire-and-forget: the audit + results email run in their own
        // invocation; the visitor never waits on the crawl or the mail server.
        void fetch("/api/free-website-audit/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ leadId: data.id }),
          keepalive: true,
        }).catch(() => {});
      }
      trackEvent("audit_requested", { location: "free_website_audit" });
      setStatus("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-brand-500/10 px-5 py-4 text-left ring-1 ring-brand-500/25">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
        <p className="text-sm font-medium text-brand-100">
          Thanks — your audit is being prepared now. Watch your inbox: your results and your
          free copy of <em>What Your Web Builder Won&rsquo;t Tell You</em> are on the way.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400";

  return (
    <form
      method="post"
      action="/api/free-website-audit/request"
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-6"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="audit-site" className="text-sm font-medium text-slate-200">
            Your website address
          </label>
          <input
            id="audit-site"
            type="text"
            name="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="joesplumbing.com"
            inputMode="url"
            autoComplete="url"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="audit-email" className="text-sm font-medium text-slate-200">
            Your email — the results go here
          </label>
          <input
            id="audit-email"
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            autoComplete="email"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="audit-name" className="text-sm font-medium text-slate-200">
            Your name <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="audit-name"
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        {/* Honeypot: real visitors never see or fill this. */}
        <div className="hidden" aria-hidden="true">
          <label>
            Company website
            <input
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            name="privacy"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className="mt-1"
          />
          <span>
            I agree to the{" "}
            <a href="/privacy" className="font-medium text-brand-300 hover:underline">
              privacy policy
            </a>{" "}
            so SitesInc can email me my audit results.
          </span>
        </label>

        {status === "error" ? (
          <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-400/25">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-3 text-base font-semibold text-zinc-950 shadow-lg shadow-brand-500/30 disabled:opacity-60"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Sending…
            </>
          ) : (
            "Email me my free audit"
          )}
        </button>
      </div>
    </form>
  );
}
