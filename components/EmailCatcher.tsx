"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { X } from "lucide-react";
import EmailCapture from "@/components/EmailCapture";
import {
  EMAIL_CATCHER_AUTO_OPEN_MS,
  EMAIL_CATCHER_DISMISSED_KEY,
  EMAIL_CATCHER_SUBMITTED_KEY,
  isEmailCatcherInternalPath,
  isEmailCatcherTrigger,
  shouldAutoOpenEmailCatcher,
} from "@/lib/email-catcher";

function storageFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setStorageFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Private mode can block sessionStorage. The popup still works this visit.
  }
}

function isCatcherTrigger(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const link = target.closest("a");
  if (!link) return false;
  return isEmailCatcherTrigger({
    href: link.getAttribute("href"),
    cta: link.getAttribute("data-analytics-cta"),
    catcher: link.getAttribute("data-email-catcher"),
    insideCatcher: Boolean(link.closest("[data-email-catcher-root]")),
  });
}

/**
 * Email catcher: pops up before a start-build click, and once on its own so
 * the form is in front of the visitor before they bounce.
 */
export default function EmailCatcher() {
  const pathname = usePathname() || "/";
  const segment = useSelectedLayoutSegment();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hidden = segment === "client-domain" || isEmailCatcherInternalPath(pathname);

  const close = useCallback(() => {
    setOpen(false);
    setStorageFlag(EMAIL_CATCHER_DISMISSED_KEY);
  }, []);

  const openCatcher = useCallback(() => {
    if (storageFlag(EMAIL_CATCHER_SUBMITTED_KEY)) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (hidden) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (!isCatcherTrigger(event.target)) return;
      if (storageFlag(EMAIL_CATCHER_SUBMITTED_KEY)) return;
      event.preventDefault();
      event.stopPropagation();
      openCatcher();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hidden, openCatcher]);

  useEffect(() => {
    if (hidden || !shouldAutoOpenEmailCatcher(pathname)) return;
    if (storageFlag(EMAIL_CATCHER_DISMISSED_KEY) || storageFlag(EMAIL_CATCHER_SUBMITTED_KEY)) {
      return;
    }
    const timer = window.setTimeout(() => openCatcher(), EMAIL_CATCHER_AUTO_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [hidden, openCatcher, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = dialogRef.current?.querySelector<HTMLElement>("input, button, textarea");
    focusable?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [close, open]);

  if (hidden || !open) return null;

  return (
    <div
      data-email-catcher-root
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-catcher-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-canvas px-6 py-8 shadow-elevated sm:px-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close email catcher"
        >
          <X className="h-5 w-5" />
        </button>
        <EmailCapture
          layout="dialog"
          onSuccess={() => {
            setStorageFlag(EMAIL_CATCHER_SUBMITTED_KEY);
            setStorageFlag(EMAIL_CATCHER_DISMISSED_KEY);
          }}
        />
      </div>
    </div>
  );
}
