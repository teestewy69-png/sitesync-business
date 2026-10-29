import type { Metadata } from "next";
import SitePage from "@/components/SitePage";

const KIT_LINK = "https://buy.stripe.com/bJedR91aJadraX3dIma3u0h";
const DEPOSIT = "https://buy.stripe.com/4gM7sL7z74T7aX38o2a3u05";

export const metadata: Metadata = {
  title: "Small Business Website & Google Visibility Kit | Sitesinc",
  description: "A $27 downloadable checklist for your domain, website must-haves and Google visibility. Your $27 is credited toward a Sitesinc website build.",
  alternates: { canonical: "/website-kit" },
};

const items = [
  "Business basics worksheet: name, phone, hours and service area used the same way everywhere",
  "Domain & email checklist so you, not a vendor, own your domain",
  "Website must-haves: click-to-call, working forms, service pages, HTTPS, legal pages",
  "Google visibility: Business Profile, Search Console + sitemap, GA4, schema, reviews, directories",
  "A list of tools small businesses commonly use",
];

export default function WebsiteKitPage() {
  return (
    <SitePage>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-300">We build real, working websites, not subscriptions like the rest.</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Small Business Website &amp; Google Visibility Kit</h1>
        <p className="mt-4 text-base text-slate-300">Want to do it yourself first? This downloadable PDF checklist walks you through what a small business website needs and how to get it seen on Google.</p>
        <ul className="mt-6 list-disc space-y-2 pl-6 text-slate-200">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        <div className="mt-8 rounded-2xl border border-brand-400/60 bg-brand-500/5 p-5">
          <p className="text-lg font-semibold">$27 one-time</p>
          <p className="mt-1 text-sm text-slate-300">Bonus: your $27 is credited toward a $1,995 Sitesinc website build.</p>
          <a href={KIT_LINK} className="mt-4 inline-flex rounded-xl bg-brand-500 px-5 py-3 font-semibold text-black hover:bg-brand-400">Get the Kit – $27</a>
        </div>
        <p className="mt-8 text-sm text-slate-400">Rather skip the DIY? <a href={DEPOSIT} className="text-brand-300 hover:underline">Start your website build</a>. Questions: <a href="mailto:save@sitesinc.co" className="text-brand-300 hover:underline">save@sitesinc.co</a> · <a href="tel:+19092323536" className="text-brand-300 hover:underline">(909) 232-3536</a></p>
      </section>
    </SitePage>
  );
}
