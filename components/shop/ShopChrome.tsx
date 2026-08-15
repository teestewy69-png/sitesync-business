import type { ReactNode } from "react";
import ShopNav from "@/components/shop/ShopNav";

/**
 * Shared chrome for storefront demo pages (/shop, /cart, /checkout).
 */
export default function ShopChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <ShopNav />
      {children}
    </div>
  );
}
