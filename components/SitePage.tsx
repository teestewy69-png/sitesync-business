import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";

export default function SitePage({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader />
      {children}
      <Footer />
    </main>
  );
}
