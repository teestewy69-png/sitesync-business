import type { Metadata } from "next";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import FreeBookForm from "@/components/FreeBookForm";
import { GUIDE } from "@/lib/free-book";
import { OG_IMAGE } from "@/lib/og-image";
import { LOCATIONS_ORIGIN } from "@/lib/locations";

const title = "Free Ebook: What Your Web Builder Won't Tell You | Sitesinc";
const description =
  "Get the free ebook: the 14 hidden costs behind a website's sticker price, a three-year worksheet to calculate the real price of any quote, three worked comparisons, and the 10 questions to ask any builder before you sign.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/free-book` },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: `${LOCATIONS_ORIGIN}/free-book`, images: [OG_IMAGE] },
};

export default function FreeBookPage() {
  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Free ebook
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          What your web builder won&apos;t tell you.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-300">
          A website&apos;s sticker price is almost never its real price. This free ebook lists
          every hidden cost — the monthly slices, the missing line items, the exit fees — and
          gives you a worksheet to calculate the true three-year cost of any quote before you
          sign it.
        </p>

        <FreeBookForm />

        <div className="mx-auto mt-14 max-w-xl text-left">
          <h2 className="text-center text-xl font-semibold">What&apos;s inside</h2>
          <ul className="mt-4 space-y-2">
            {GUIDE.chapters.map((chapter) => (
              <li
                key={chapter.heading}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                {chapter.heading.replace(/^Chapter \d+: /, "")}
                <span className="text-slate-400"> — {chapter.teaser}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-slate-400">
            When you&apos;re ready for the site itself: SitesInc builds real, working websites for
            a flat one-time fee — $1,995, no subscriptions.
          </p>
        </div>
      </section>
    </SitePage>
  );
}
