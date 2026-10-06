"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides Sitesinc's own marketing chrome (pricing ticker) on per-client preview pages: a client's
 * site and City Launch landing pages must not carry Sitesinc's sales banner.
 */
export default function HideOnClientSite({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/demo/client/")) return null;
  return <>{children}</>;
}
