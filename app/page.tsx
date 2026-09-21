import dynamic from "next/dynamic";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";
import Process from "@/components/Process";
import About from "@/components/About";
import ContentEngine from "@/components/ContentEngine";
import Proof from "@/components/Proof";
import FAQ from "@/components/FAQ";
import ProductTeaser from "@/components/ProductTeaser";
import EmailCapture from "@/components/EmailCapture";
import Footer from "@/components/Footer";
import SeoJsonLd from "@/components/SeoJsonLd";

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

const PickYourDesign = dynamic(() => import("@/components/PickYourDesign"), {
  loading: () => (
    <section className="border-t border-white/5 bg-black py-16" aria-busy="true">
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-10 w-64 animate-pulse rounded bg-white/10" />
        <div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/5" />
      </div>
    </section>
  ),
});

export default function Home() {
  return (
    <>
      <SeoJsonLd />
      <Hero />
      <DesignShowcase />
      <PickYourDesign />
      <Pricing />
      <Process />
      <About />
      <ContentEngine />
      <Proof />
      <FAQ />
      <ProductTeaser />
      <EmailCapture />
      <Footer />
    </>
  );
}
