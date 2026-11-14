import type { Metadata } from "next";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import StartChecklistForm from "@/components/StartChecklistForm";
import { CHECKLIST } from "@/lib/lead-magnet";
import { OG_IMAGE } from "@/lib/og-image";
import { LOCATIONS_ORIGIN } from "@/lib/locations";

const title = "Free New Business Website Starter Checklist | Sitesinc";
const description =
  "Starting a business? Get the free New Business Website Starter Checklist: what to decide, what to gather, the pages you need, Google Business Profile basics, and the cost traps to avoid.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/start` },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: `${LOCATIONS_ORIGIN}/start`, images: [OG_IMAGE] },
};

export default function StartPage() {
  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Free checklist
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Starting a business? Start with the checklist.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-300">
          The New Business Website Starter Checklist is the same list we work through on every
          SitesInc build, written for people who know nothing about websites — yet. What to
          decide, what to gather, and which expensive mistakes to step around, in one short read.
        </p>

        <StartChecklistForm />

        <div className="mx-auto mt-14 max-w-xl text-left">
          <h2 className="text-center text-xl font-semibold">What&apos;s inside</h2>
          <ul className="mt-4 space-y-2">
            {CHECKLIST.sections.map((section) => (
              <li
                key={section.heading}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                {section.heading}
                <span className="text-slate-400"> — {section.items.length} things to check off</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-slate-400">
            When you&apos;re ready for the site itself: SitesInc builds real, working websites for
            a flat one-time fee — pilot pricing of $1,495 for our first 3 clients (regularly
            $1,995), no subscriptions.
          </p>
        </div>
      </section>
    </SitePage>
  );
}
