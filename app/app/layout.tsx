import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Sitesinc factory (internal)", template: "%s · Sitesinc factory" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
