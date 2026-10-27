import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/og-image";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";

export const metadata: Metadata = {
  title: "DMCA Copyright & Acceptable Use Policy | Sitesinc",
  description:
    "Digital Millennium Copyright Act (DMCA) notice procedure and Acceptable Use Policy for Sitesinc (sitesinc.co).",
  alternates: { canonical: "/dmca" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "DMCA Copyright & Acceptable Use Policy | Sitesinc",
    description:
      "Digital Millennium Copyright Act (DMCA) notice procedure and Acceptable Use Policy for Sitesinc (sitesinc.co).",
    url: "/dmca",
    images: [OG_IMAGE],
  },
};

export default function DmcaPage() {
  return (
    <SitePage>
      <OrgJsonLd />
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          DMCA &amp; Acceptable Use Policy
        </h1>
        <p className="mt-3 text-base text-slate-400">
          Effective date: October 23, 2026
        </p>

        <div className="mt-8 space-y-8 text-base leading-7 text-slate-300">
          <section>
            <p>
              Sitesinc respects the intellectual property rights of others and complies with the Digital Millennium Copyright Act (17 U.S.C. &sect; 512).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              1. Reporting Copyright Infringement (DMCA Notice)
            </h2>
            <p className="mt-2">
              If you believe that content hosted on <span className="text-slate-100">sitesinc.co</span> infringes your copyright, please submit a written notice via our{" "}
              <Link href="/contact" className="text-sky-400 underline">contact page</Link> with the subject line &ldquo;DMCA Takedown Notice&rdquo; containing:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Your physical or electronic signature as the copyright owner or authorized representative.</li>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>The specific URL(s) on sitesinc.co where the allegedly infringing material is located.</li>
              <li>Your full name, mailing address, telephone number, and email address.</li>
              <li>A statement that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, made under penalty of perjury, that the above information is accurate and that you are the copyright owner or authorized to act on the owner&rsquo;s behalf.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              2. Acceptable Use Policy
            </h2>
            <p className="mt-2">
              Users of sitesinc.co and client sites built by Sitesinc may not use our services or infrastructure to transmit unlawful, defamatory, infringing, or malicious material, attempt unauthorized access to administrative endpoints, or perform automated denial-of-service or scraping attacks. See our{" "}
              <Link href="/terms" className="text-sky-400 underline">Terms of Service</Link> for full contractual terms.
            </p>
          </section>
        </div>
      </div>
    </SitePage>
  );
}
