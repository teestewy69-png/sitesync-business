import type { Metadata } from "next";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import GiveawayEntryForm from "@/components/GiveawayEntryForm";
import { formatCents } from "@/data/products";
import {
  DRAW_DATE_TEXT,
  EBOOK_PICK_COUNT,
  ENTRIES_CLOSE_TEXT,
  GIVEAWAY_RULES,
  NEWSLETTER_MONTHS,
  RUNNER_UP_COUNT,
  RUNNER_UP_PRIZE_NAME,
  WEBSITE_BUILD_VALUE_CENTS,
  WINNER_PRICE_CENTS,
  prizeGuides,
} from "@/lib/giveaway";
import { OG_IMAGE } from "@/lib/og-image";
import { LOCATIONS_ORIGIN } from "@/lib/locations";

const title = "Win a $1,995 Website for $200 | The SitesInc Website Giveaway";
const description =
  "No website yet? Enter free for a chance to get a full SitesInc website build (regularly $1,995) for just $200, plus a monthly newsletter for 6 months and two ebooks. No purchase necessary to enter. Winner drawn Friday, November 27, 2026.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/giveaway` },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: `${LOCATIONS_ORIGIN}/giveaway`, images: [OG_IMAGE] },
};

export default function GiveawayPage() {
  const guides = prizeGuides();

  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Free to enter — no purchase necessary
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your business has no website. Win one for $200.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-300">
          We&apos;re drawing one small business to get a complete SitesInc website build — the
          full {formatCents(WEBSITE_BUILD_VALUE_CENTS)} build — for just{" "}
          {formatCents(WINNER_PRICE_CENTS)}, plus a monthly newsletter for {NEWSLETTER_MONTHS}{" "}
          months and two ebooks. Enter free below. The winner is drawn on {DRAW_DATE_TEXT}.
        </p>

        <GiveawayEntryForm />

        <div className="mx-auto mt-14 max-w-xl text-left">
          <h2 className="text-center text-xl font-semibold">The grand prize</h2>
          <div className="mt-4 space-y-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <p className="flex items-baseline justify-between gap-4">
                <span>
                  A standard SitesInc website build — a real, working website for your business,
                  built and launched for you. One-time fee, no subscription, the same build our
                  paying clients get.
                </span>
                <span className="shrink-0 font-semibold text-brand-200">
                  {formatCents(WEBSITE_BUILD_VALUE_CENTS)} build for {formatCents(WINNER_PRICE_CENTS)}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              A monthly newsletter for your business, written and sent by SitesInc for{" "}
              {NEWSLETTER_MONTHS} months — so your customers hear from you every month while
              you run the business.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Any {EBOOK_PICK_COUNT} ebooks from the guide library below, your choice, delivered
              by email.
            </div>
          </div>

          <h3 className="mt-8 text-center text-base font-semibold">
            Pick any {EBOOK_PICK_COUNT} — the guide library
          </h3>
          <ul className="mt-4 space-y-2">
            {guides.map((guide) => (
              <li
                key={guide.slug}
                className="flex items-baseline justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                <span>{guide.name}</span>
                <span className="shrink-0 text-slate-400">{formatCents(guide.priceCents)}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 text-center text-xl font-semibold">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-slate-200">
            <li>Enter free above — first name, email, and your business name. That&apos;s it.</li>
            <li>Entries close {ENTRIES_CLOSE_TEXT}.</li>
            <li>
              One winner is drawn at random on {DRAW_DATE_TEXT} and notified by email. The winner
              pays {formatCents(WINNER_PRICE_CENTS)} for the build when they claim the prize.{" "}
              {RUNNER_UP_COUNT} runner-ups each get the {RUNNER_UP_PRIZE_NAME} guide.
            </li>
            <li>We build the winner&apos;s website and announce the business on our socials.</li>
          </ol>
          <p className="mt-6 text-center text-sm text-slate-300">
            Every entrant also gets the free New Business Website Starter Checklist — the same
            list we work through on every build — in the confirmation email.
          </p>

          <h2 className="mt-12 text-center text-xl font-semibold">The rules, in plain English</h2>
          <ul className="mt-4 space-y-2">
            {GIVEAWAY_RULES.map((rule) => (
              <li
                key={rule}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300"
              >
                {rule}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-slate-400">
            Can&apos;t wait for a drawing? SitesInc builds real, working websites for a flat
            one-time fee — $1,995, no subscriptions.
          </p>
        </div>
      </section>
    </SitePage>
  );
}
