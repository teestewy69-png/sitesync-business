import type { Metadata } from "next";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = {
  title: "Sitesinc — Coming Soon",
  description:
    "Sitesinc is a website factory. Done-for-you site generation, SEO, monetization, and SEO Intelligence. Join the waitlist.",
};

export default function LandingPage() {
  return <ComingSoon />;
}
