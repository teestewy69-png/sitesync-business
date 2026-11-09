import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import CheckoutChrome from "@/components/siteflow/CheckoutChrome";
import { siteflowEnabled } from "@/lib/siteflow/flag";

// Evaluated per request so the SiteFlow flag is read at runtime, not baked in at build time.
// Same gate as app/cart/layout.tsx and app/checkout/layout.tsx.
export const dynamic = "force-dynamic";
// The storefront is deliberately unlisted: reachable by direct link, never indexed or
// linked from the public navigation. Its products are sold, not search-landed.
export const metadata = { robots: { index: false, follow: false } };

export default function StoreLayout({ children }: { children: ReactNode }) {
  // The store sells through SiteFlow: /store does not exist unless SITEFLOW_ENABLED is set.
  if (!siteflowEnabled()) notFound();
  return <CheckoutChrome>{children}</CheckoutChrome>;
}
