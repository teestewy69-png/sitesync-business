import Hero from "@/components/Hero";
import DesignShowcase from "@/components/DesignShowcase";
import Pricing from "@/components/Pricing";
import Process from "@/components/Process";
import About from "@/components/About";
import ContentEngine from "@/components/ContentEngine";
import Proof from "@/components/Proof";
import FAQ from "@/components/FAQ";
import ProductTeaser from "@/components/ProductTeaser";
import EmailCapture from "@/components/EmailCapture";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Hero />
      <DesignShowcase />
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