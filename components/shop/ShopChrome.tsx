import type { ReactNode } from "react";
import ShopNav from "@/components/shop/ShopNav";

/**
 * Shared chrome for /shop (inquiry-only while SiteFlow is paused) and, when SiteFlow is enabled, /cart and
 * /checkout. `commerce` shows the Cart and Checkout links; without it the nav has no buying paths.
 */
export default function ShopChrome({ children, commerce = false }: { children: ReactNode; commerce?: boolean }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <ShopNav commerce={commerce} />
      <main id="main-content">{children}</main>
    </div>
  );
}
