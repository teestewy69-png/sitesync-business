import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import CheckoutChrome from "@/components/siteflow/CheckoutChrome";
import { siteflowEnabled } from "@/lib/siteflow/flag";

// Evaluated per request so the SiteFlow flag is read at runtime, not baked in at build time.
// Same gate as app/cart/layout.tsx and app/checkout/layout.tsx.
export const dynamic = "force-dynamic";
// Store visibility (Tony's decision, 2026-11-25): the store is OPEN — indexable,
// followed, in the sitemap, and linked from the sitewide footer. This reverses the
// earlier deliberate-unlisted setting. /cart and /checkout are NOT store pages:
// they stay noindex as approved utility pages (their own layouts own that).
export const metadata = { robots: { index: true, follow: true } };

export default function StoreLayout({ children }: { children: ReactNode }) {
  // The store sells through SiteFlow: /store does not exist unless SITEFLOW_ENABLED is set.
  if (!siteflowEnabled()) notFound();
  return <CheckoutChrome>{children}</CheckoutChrome>;
}
