import type { ReactNode } from "react";
import ShopChrome from "@/components/shop/ShopChrome";

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <ShopChrome>{children}</ShopChrome>;
}
