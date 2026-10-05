"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  isAllowedAnalyticsHost,
  isExcludedAnalyticsPath,
  trackCtaClick,
} from "@/lib/analytics";

type AnalyticsProps = {
  measurementId: string;
  /** Hostnames allowed to load GA. Anything else (localhost, previews) loads nothing. */
  allowedHosts: string[];
};

const noopSubscribe = () => () => {};

/**
 * GA4 via next/script. Loads only on an allowed host and only on a
 * non-excluded route. Page views are sent manually on every App Router
 * pathname change (send_page_view is off to avoid double counting).
 */
export default function Analytics({ measurementId, allowedHosts }: AnalyticsProps) {
  const pathname = usePathname() || "/";
  // false on the server and during hydration, real answer on the client.
  const hostAllowed = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(measurementId) && isAllowedAnalyticsHost(window.location.hostname, allowedHosts),
    () => false
  );
  const enabled = hostAllowed && !isExcludedAnalyticsPath(pathname);

  // Init the gtag queue (once) and send a page_view on every route change.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window.gtag !== "function") {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        // gtag.js expects the Arguments object, not an array.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });
    }
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
    });
  }, [enabled, pathname, measurementId]);

  // Delegated CTA tracking: any element with data-analytics-cta="name".
  useEffect(() => {
    if (!hostAllowed) return;
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const el = target?.closest?.("[data-analytics-cta]");
      if (!el) return;
      trackCtaClick(el.getAttribute("data-analytics-cta") || "unknown", {
        cta_location: el.getAttribute("data-analytics-location") || undefined,
        link_url: el.getAttribute("href") || undefined,
      });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [hostAllowed]);

  if (!enabled) return null;

  // next/script loads this once per session, even if the component re-mounts.
  return (
    <Script
      id="ga4-gtag"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
  );
}
