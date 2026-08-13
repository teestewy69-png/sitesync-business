import Hero from "@/components/Hero";
import DesignChooser from "@/components/DesignChooser";
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
      <DesignChooser />
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
