"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import content from "@/content.json";
import { trackLead } from "@/lib/analytics";
import { GUIDE_OFFER_ID, GUIDE_PATH, GUIDE_TITLE } from "@/lib/lead-guide";
import {
  DESKTOP_EXIT_TOP_PX,
  DWELL_THRESHOLD_MS,
  SEEN_STORAGE_KEY,
  hasSeenRecently,
  isExcludedPath,
  isExitScrollBurst,
  shouldArm,
} from "@/lib/exit-intent";

type Status = "idle" | "loading" | "success" | "error";

function readSeenAt(): string | null {
  try {
    return window.localStorage.getItem(SEEN_STORAGE_KEY);
  } catch {
    return null; // Private mode / blocked storage must never throw.
  }
}

function writeSeenAt() {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, new Date().toISOString());
  } catch {
    // Same: a failed write only means the popup may show again next visit.
  }
}

/**
 * One-time exit-intent popup offering the free guide (and an optional free audit). Decision rules
 * live in lib/exit-intent.ts; this component only wires them to the DOM and
 * mirrors EmailCapture's /api/subscribe contract exactly (same endpoint,
 * payload fields, honeypot, Idempotency-Key, required privacy consent).
 * Mounted globally in app/layout.tsx; self-excludes on commerce, factory,
 * API, and the audit / guide pages themselves.
 */
export default function ExitIntentCapture() {
  const pathname = usePathname() || "/";
  const { emailCapture, footer } = content;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const firedRef = useRef(false);
  const lastFocusedRef = useRef<Element | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef("");
  const submitting = useRef(false);

  // Arm the triggers once the visitor has dwelled long enough on an eligible page.
  useEffect(() => {
    if (firedRef.current) return;
    if (isExcludedPath(pathname)) return;
    const seen = hasSeenRecently(readSeenAt());
    if (seen) return;

    const startedAt = Date.now();
    let detach: (() => void) | null = null;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      detach?.();
      writeSeenAt();
      lastFocusedRef.current = document.activeElement;
      setOpen(true);
    };

    const attach = () => {
      let prevY = window.scrollY;
      let maxY = window.scrollY;
      let anchor: { y: number; t: number } | null = null;

      const onMouseOut = (event: MouseEvent) => {
        if (!event.relatedTarget && event.clientY <= DESKTOP_EXIT_TOP_PX) fire();
      };
      const onScroll = () => {
        const y = window.scrollY;
        if (y > maxY) maxY = y;
        if (y < prevY) {
          if (!anchor) anchor = { y: prevY, t: Date.now() };
          if (
            isExitScrollBurst({
              maxScrollY: maxY,
              fromY: anchor.y,
              toY: y,
              elapsedMs: Date.now() - anchor.t,
            })
          ) {
            fire();
            return;
          }
        } else if (y > prevY) {
          anchor = null;
        }
        prevY = y;
      };

      document.addEventListener("mouseout", onMouseOut);
      window.addEventListener("scroll", onScroll, { passive: true });
      detach = () => {
        document.removeEventListener("mouseout", onMouseOut);
        window.removeEventListener("scroll", onScroll);
      };
    };

    const timer = window.setTimeout(() => {
      if (
        shouldArm({
          pathname,
          dwellMs: Date.now() - startedAt,
          alreadySeen: hasSeenRecently(readSeenAt()),
        })
      ) {
        attach();
      }
    }, DWELL_THRESHOLD_MS);

    return () => {
      window.clearTimeout(timer);
      detach?.();
    };
  }, [pathname]);

  // Focus the email field on open; Escape dismisses.
  useEffect(() => {
    if (!open) return;
    emailInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open ]);

  function dismiss() {
    setOpen(false);
    const el = lastFocusedRef.current;
    if (el instanceof HTMLElement) {
      try {
        el.focus();
      } catch {
        // Focus return is a nicety, never an error.
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status === "success") return;
    submitting.current = true;
    if (!idempotencyKey.current) {
      idempotencyKey.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    }
    setStatus("loading");
    setErrorMessage("");

    const url = siteUrl.trim();
    const details = url
      ? `Exit popup — free guide (${GUIDE_TITLE}) + audit my site: ${url}`
      : `Exit popup — free guide (${GUIDE_TITLE})`;

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          name,
          email,
          privacy,
          monitoring: false,
          offer: GUIDE_OFFER_ID,
          details,
          company_website: honeypot,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setSuccessMessage(
        data?.warning
          ? "Saved. The email couldn't send right now, but you can read the guide here now."
          : url
            ? "Done. The guide is on its way to your inbox, and we'll email you what we find when we check your site."
            : "Done. The guide is on its way to your inbox."
      );
      setStatus("success");
      // Only after the lead was saved. No PII in params.
      trackLead("free_guide_request", { source: "exit_intent" });
    } catch (err) {
      submitting.current = false;
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-capture-title"
        className="relative w-full max-w-md rounded-2xl bg-surface-elevated p-8 shadow-glow ring-1 ring-white/10"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 ring-1 ring-white/10 transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Free guide
        </p>
        <h2
          id="exit-capture-title"
          className="mt-2 text-2xl font-bold tracking-tight text-white"
        >
          Before you go
        </h2>
        <p className="mt-3 text-base text-slate-400">
          Get our free guide, &ldquo;{GUIDE_TITLE}.&rdquo; It&apos;s a short,
          plain-English checklist you can run on your own site in a few
          minutes. Add your website if you&apos;d also like a free audit. No
          charge, no sales call.
        </p>

        {status === "success" ? (
          <div className="mt-6">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-brand-500/10 px-5 py-4 text-sm font-medium text-brand-200 ring-1 ring-brand-500/25">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {successMessage}
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="mt-4 w-full rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            method="post"
            action="/api/subscribe"
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col gap-3"
          >
            <label className="sr-only" htmlFor="exit-capture-name">
              Your name
            </label>
            <input
              id="exit-capture-name"
              type="text"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={emailCapture.namePlaceholder}
              autoComplete="name"
              className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <label className="sr-only" htmlFor="exit-capture-email">
              Email address
            </label>
            <input
              ref={emailInputRef}
              id="exit-capture-email"
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailCapture.placeholder}
              autoComplete="email"
              className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <label className="sr-only" htmlFor="exit-capture-url">
              Your website (optional)
            </label>
            <input
              id="exit-capture-url"
              type="text"
              name="site_url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="yourbusiness.com (optional, for a free audit)"
              autoComplete="url"
              inputMode="url"
              className="w-full rounded-xl bg-surface-elevated px-4 py-3 text-white ring-1 ring-white/10 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="exit-capture-company_website">Company website</label>
              <input
                id="exit-capture-company_website"
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
              {status === "loading" ? "Sending..." : "Email me the free guide"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="mt-3 text-sm text-red-400">{errorMessage}</p>
        )}

        <p className="mt-4 text-center text-sm">
          <Link
            href={GUIDE_PATH}
            onClick={dismiss}
            className="font-medium text-brand-300 hover:underline"
          >
            Read the guide now
          </Link>
          {status !== "success" && (
            <>
              {" · "}
              <Link
                href="/free-website-audit"
                onClick={dismiss}
                className="font-medium text-brand-300 hover:underline"
              >
                Or run the audit now
              </Link>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-sm text-slate-400">
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
    </div>
  );
}
