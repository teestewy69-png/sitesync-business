import type { ReactNode } from "react";
import CheckoutChrome from "@/components/siteflow/CheckoutChrome";
import SitePage from "@/components/SitePage";
import { siteflowEnabled } from "@/lib/siteflow/flag";

// Evaluated per request so the SiteFlow flag is read at runtime, not baked in at build time.
export const dynamic = "force-dynamic";
export const metadata = {
  // Unique title (2026-11-25 audit): checkout fell back to the homepage title.
  title: "Checkout | SitesInc",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  if (siteflowEnabled()) {
    return <CheckoutChrome>{children}</CheckoutChrome>;
  }
  return <SitePage>{children}</SitePage>;
}
