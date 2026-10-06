import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import CheckoutChrome from "@/components/siteflow/CheckoutChrome";
import { siteflowEnabled } from "@/lib/siteflow/flag";

// Evaluated per request so the SiteFlow flag is read at runtime, not baked in at build time.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  // Product checkout is paused with SiteFlow (phase 2): /checkout does not exist unless SITEFLOW_ENABLED is set.
  if (!siteflowEnabled()) notFound();
  return <CheckoutChrome>{children}</CheckoutChrome>;
}
