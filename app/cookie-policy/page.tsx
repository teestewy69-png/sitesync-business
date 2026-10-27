import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/og-image";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";

export const metadata: Metadata = {
  title: "Cookie Policy | Sitesinc Small Business Websites",
  description:
    "How Sitesinc (sitesinc.co) uses essential, functional, and analytics cookies and how you can manage your browser preferences.",
  alternates: { canonical: "/cookie-policy" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Cookie Policy | Sitesinc Small Business Websites",
    description:
      "How Sitesinc (sitesinc.co) uses essential, functional, and analytics cookies and how you can manage your browser preferences.",
    url: "/cookie-policy",
    images: [OG_IMAGE],
  },
};

export default function CookiePolicyPage() {
  return (
    <SitePage>
      <OrgJsonLd />
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Cookie Policy
        </h1>
        <p className="mt-3 text-base text-slate-400">
          Effective date: October 23, 2026
        </p>

        <div className="mt-8 space-y-8 text-base leading-7 text-slate-300">
          <section>
            <p>
              This Cookie Policy explains how Sitesinc uses cookies and similar technologies on{" "}
              <span className="text-slate-100">sitesinc.co</span>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              1. What Are Cookies?
            </h2>
            <p className="mt-2">
              Cookies are small text files stored by your web browser when you visit a website. They help websites remember session state, keep forms secure, and measure aggregate site performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              2. Cookies We Use
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium text-slate-100">Essential &amp; Security Cookies:</span> Used to protect intake and contact forms against spam, maintain workspace authentication for authorized team members, and route checkout sessions securely through Stripe.
              </li>
              <li>
                <span className="font-medium text-slate-100">Performance &amp; Analytics Cookies:</span> Used to measure aggregate page views, load times, and visitor navigation across our marketing pages, blog, and{" "}
                <Link href="/locations" className="text-sky-400 underline">500 U.S. city guides</Link>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-100">
              3. Managing Your Cookie Preferences
            </h2>
            <p className="mt-2">
              Most browsers allow you to block or delete cookies via their privacy settings. Disabling non-essential cookies will not affect your ability to browse Sitesinc, read our guides, or submit a project request. For more information on how we handle personal data, see our{" "}
              <Link href="/privacy" className="text-sky-400 underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </div>
    </SitePage>
  );
}
