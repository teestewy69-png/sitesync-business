import type { Metadata } from "next";
import { OG_IMAGE } from "@/lib/og-image";
import content from "@/content.json";
import Process from "@/components/Process";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";

export const metadata: Metadata = {
  title: "About Sitesinc | Small Business Website Builders",
  description: "Sitesinc builds real working websites for small and local businesses: custom design, SEO, lead capture and hosting, with full code you own. $1,995 flat.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Sitesinc | Small Business Website Builders",
    description: "Sitesinc builds real working websites for small and local businesses: custom design, SEO, lead capture and hosting, with full code you own. $1,995 flat.",
    url: "/about", images: [OG_IMAGE],
  },
};

export default function AboutPage() {
  const { about } = content;

  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-4xl space-y-4 px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">About</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{about.title}</h1>
        {about.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-base text-slate-300">
            {paragraph}
          </p>
        ))}
        <p className="pt-2">
          <a href="/contact" className="font-medium text-brand-300 hover:underline">
            Contact us
          </a>
          {" · "}
          <a href="/services" className="font-medium text-brand-300 hover:underline">
            See what’s included
          </a>
        </p>
      </section>
      <Process />
    </SitePage>
  );
}
