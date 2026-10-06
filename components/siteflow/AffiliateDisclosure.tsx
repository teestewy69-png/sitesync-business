import { affiliateDisclosureText } from "@/lib/affiliates";

/** Shown wherever outbound partner links appear. */
export default function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return <p className={`text-xs text-slate-500 ${className}`}>{affiliateDisclosureText()}</p>;
}
