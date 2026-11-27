import dynamic from "next/dynamic";
import type { Metadata } from "next";
import content from "@/content.json";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";
import Outcomes from "@/components/Outcomes";
import Process from "@/components/Process";
import VisualBreak from "@/components/VisualBreak";
import About from "@/components/About";
import Proof from "@/components/Proof";
import FAQ from "@/components/FAQ";
import HubLinks from "@/components/HubLinks";
import FreeResources from "@/components/FreeResources";
import Footer from "@/components/Footer";
import SeoJsonLd from "@/components/SeoJsonLd";
import TradePicker from "@/components/TradePicker";
import FreeAuditBanner from "@/components/PilotOffer";

export const metadata: Metadata = {
  title: { absolute: content.seo.title },
  description: content.seo.description,
  // Explicit self-referencing canonical for the homepage (audit fix,
  // 2026-11-25: the homepage shipped with no canonical of its own).
  // Host convention sitewide is the apex in content.seo.url / sitemap.
  alternates: { canonical: "/" },
};

const DesignShowcase = dynamic(() => import("@/components/DesignShowcase"), {
  loading: () => (
    <section
      id="designs"
      className="border-t border-white/5 bg-black py-16 text-white sm:py-20"
      aria-busy="true"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-10 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-white/5" />
        <div className="mt-8 h-[28rem] animate-pulse rounded-[30px] bg-white/5" />
      </div>
    </section>
  ),
});

/**
 * Homepage composition — declutter pass (2026-11-25).
 * One message per section, in reading order: offer → trades → designs →
 * pricing → free audit → outcomes → process → visual break → about →
 * proof → FAQ → free resources → hub directory → footer.
 * Redesign v2 (visual layer, same day): hero photograph, a photo on every
 * trade card, real rendered thumbnails for the 8 designs, an illustrated
 * onboarding checklist + 50/50 split visual in Pricing, and the mid-page
 * VisualBreak photograph — imagery added, no copy facts changed.
 * Removed as duplicates (components still exist and are used elsewhere
 * or available to restore): TwoAudiencePitch (its two-audience message is
 * carried by the hero + the audit strip), PickYourDesign (duplicated
 * DesignShowcase), ContentEngine (its SEO-foundation point is made by
 * Outcomes and /seo-ready-websites), EmailCapture (its checklist offer
 * is carried by FreeResources, which links to the same form pages).
 */
/**
 * Homepage composition — declutter pass (2026-11-25).
 * One message per section, in reading order: offer → trades → designs →
 * pricing → free audit → outcomes → process → visual break → about →
 * proof → FAQ → free resources → hub directory → footer.
 * Redesign v2 (visual layer, same day): hero photograph, a photo on every
 * trade card, real rendered thumbnails for the 8 designs, an illustrated
 * onboarding checklist + 50/50 split visual in Pricing, and the mid-page
 * VisualBreak photograph — imagery added, no copy facts changed.
 * Removed as duplicates (components still exist and are used elsewhere
 * or available to restore): TwoAudiencePitch (its two-audience message is
 * carried by the hero + the audit strip), PickYourDesign (duplicated
 * DesignShowcase), ContentEngine (its SEO-foundation point is made by
 * Outcomes and /seo-ready-websites), EmailCapture (its checklist offer
 * is carried by FreeResources, which links to the same form pages).
 *
 * 2026-11-27 giveaway-rerun pass (founder order): the free-audit offer
 * now runs as FOUR enlarged bands at strategic points — under the hero,
 * after Pricing (the original strip's spot, enlarged), after Proof, and
 * as the final CTA before the footer. Reading order: offer → free audit
 * → trades → designs → pricing → free audit → outcomes → process →
 * visual break → about → proof → free audit → FAQ → free resources →
 * hub directory → free audit → footer.
 */
export default function Home() {
  return (
    <>
      <SeoJsonLd />
      <Hero />
      <FreeAuditBanner size="band" location="home_hero" />
      <TradePicker />
      <DesignShowcase />
      <Pricing />
      <FreeAuditBanner size="band" />
      <Outcomes />
      <Process />
      <VisualBreak />
      <About />
      <Proof />
      <FreeAuditBanner size="band" location="home_proof" />
      <FAQ />
      <FreeResources />
      <HubLinks />
      <FreeAuditBanner size="band" location="home_final" />
      <Footer />
    </>
  );
}
