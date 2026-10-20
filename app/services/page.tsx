import type { Metadata } from "next";
import { Check } from "lucide-react";
import content from "@/content.json";
import Pricing from "@/components/Pricing";
import SitePage from "@/components/SitePage";

export const metadata: Metadata = {
  title: "Website build services | Sitesinc",
  description: content.included.title,
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Website build services | Sitesinc",
    description: content.included.title,
    url: "/services",
  },
};

export default function ServicesPage() {
  const { included, outcomes, pricing } = content;

  return (
    <SitePage>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Services</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{included.title}</h1>
        <p className="mt-3 text-base text-slate-300">{pricing.subtitle}</p>
        <ul className="mt-8 space-y-3">
          {included.items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-base text-slate-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-white/5 bg-black px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{outcomes.title}</h2>
          <p className="mt-3 text-base text-slate-300">{outcomes.subtitle}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {outcomes.items.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-base font-semibold text-slate-50">{item.title}</h3>
                <p className="mt-2 text-base text-slate-300">{item.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-400">
            {outcomes.comingSoon.title}: {outcomes.comingSoon.items.join(" · ")}. {outcomes.comingSoon.note}
          </p>
        </div>
      </section>

      <Pricing />
    </SitePage>
  );
}
