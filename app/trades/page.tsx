import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE } from "@/lib/og-image";
import SitePage from "@/components/SitePage";
import OrgJsonLd from "@/components/OrgJsonLd";
import PilotOffer from "@/components/PilotOffer";
import { SERVICE_AREA, SITESINC_PHONE, SITESINC_PHONE_HREF, TRADES } from "@/data/trades";

const title = "Websites for Southern California Trades | $1,995 Flat | Sitesinc";
const description =
  "Websites for plumbers, roofers, HVAC contractors, electricians, landscapers and auto repair shops in LA, Orange, Riverside and San Bernardino counties. $1,995 flat, 50% to start.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/trades" },
  openGraph: { title, description, url: "/trades", images: [OG_IMAGE] },
};

export default function TradesHub() {
  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Trades</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your trade. Your customers. A website written for both.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-300">
          Same $1,995 flat build for every trade, $997.50 to start and $997.50 at launch. Each page below shows what we build for that kind of business. Serving {SERVICE_AREA}.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((t) => (
            <Link key={t.slug} href={`/trades/${t.slug}`} className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/60">
              <p className="text-lg font-semibold text-white">{t.name}</p>
              <p className="mt-2 text-sm text-slate-300">{t.headline}</p>
              <p className="mt-3 text-sm font-medium text-brand-300">See the page →</p>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-base text-slate-300">
          Different trade? We build for any local service business.{" "}
          <a href={SITESINC_PHONE_HREF} className="text-brand-300 hover:underline">Call {SITESINC_PHONE}</a> or{" "}
          <Link href="/contact" className="text-brand-300 hover:underline">send a request</Link>.
        </p>
      </section>
      <PilotOffer location="trades_hub" />
    </SitePage>
  );
}
