import type { ReactNode } from "react";
import ShopChrome from "@/components/shop/ShopChrome";
import { anythingPurchasable } from "@/lib/public-catalog";

export default function ShopLayout({ children }: { children: ReactNode }) {
  // Cart/Checkout links only when something can actually be bought (never while SiteFlow is paused).
  return <ShopChrome commerce={anythingPurchasable()}>{children}</ShopChrome>;
}
