"use client";

import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides Sitesinc's own marketing chrome (pricing ticker) on client sites: the per-client preview pages
 * (/demo/client/*) and the client's real domain. A real-domain request is rewritten by middleware to
 * app/client-domain/[host]/..., so the browser path is "/" or "/locations" there; the matched route segment
 * ("client-domain") is what identifies it, on the server render and on hydration alike.
 */
export default function HideOnClientSite({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const pathname = usePathname() || "/";
  if (segment === "client-domain") return null;
  if (pathname.startsWith("/demo/client/")) return null;
  return <>{children}</>;
}
