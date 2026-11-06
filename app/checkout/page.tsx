import PublicBuildCheckout from "@/components/PublicBuildCheckout";
import { siteflowEnabled } from "@/lib/siteflow/flag";
import SiteFlowCheckout from "./siteflow-checkout";

export default function CheckoutPage() {
  if (siteflowEnabled()) return <SiteFlowCheckout />;
  return <PublicBuildCheckout />;
}
