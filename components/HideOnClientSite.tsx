"use client";

import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides Sitesinc's own marketing chrome (pricing ticker) on:
 *  - the factory (/app)
 *  - per-client preview pages (/demo/client/*)
 *  - a client's real domain (middleware rewrites to app/client-domain/[host]/... so the
 *    browser path is "/" or "/locations"; the matched segment "client-domain" identifies it)
 */
export default function HideOnClientSite({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const pathname = usePathname() || "/";
  if (segment === "client-domain") return null;
  if (pathname === "/app" || pathname.startsWith("/app/")) return null;
  if (pathname.startsWith("/demo/client/")) return null;
  return <>{children}</>;
}
