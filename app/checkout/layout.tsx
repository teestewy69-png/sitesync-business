import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import ShopChrome from "@/components/shop/ShopChrome";
import { siteflowEnabled } from "@/lib/siteflow/flag";

// Evaluated per request so the SiteFlow flag is read at runtime, not baked in at build time.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  // Product checkout is paused with SiteFlow (Path A): nothing is purchasable, so /checkout does not exist.
  if (!siteflowEnabled()) notFound();
  return <ShopChrome commerce>{children}</ShopChrome>;
}
