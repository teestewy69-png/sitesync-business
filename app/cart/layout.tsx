import type { ReactNode } from "react";
import ShopChrome from "@/components/shop/ShopChrome";

export default function CartLayout({ children }: { children: ReactNode }) {
  return <ShopChrome>{children}</ShopChrome>;
}
