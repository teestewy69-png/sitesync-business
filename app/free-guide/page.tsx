import Link from "next/link";
import type { Metadata } from "next";
import { Download, PhoneCall } from "lucide-react";
import SitePage from "@/components/SitePage";
import GuideEmailForm from "@/components/GuideEmailForm";
import content from "@/content.json";
import { OG_IMAGE } from "@/lib/og-image";
import {
  GUIDE_DOWNLOAD_PATH,
  GUIDE_INTRO,
  GUIDE_ITEMS,
  GUIDE_PATH,
  GUIDE_QUICK_TEST,
  GUIDE_SUBTITLE,
  GUIDE_TITLE,
} from "@/lib/lead-guide";

const TITLE = `Free guide: ${GUIDE_TITLE} | Sitesinc`;
const DESCRIPTION =
  "A free, plain-English checklist for local service businesses: the 7 basics that make it easy for a visitor to call you.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: GUIDE_PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: GUIDE_PATH, images: [OG_IMAGE] },
};

export default function FreeGuidePage() {
  const { footer } = content;
  return (
    <SitePage>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Free guide</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{GUIDE_TITLE}</h1>
        <p className="mt-3 text-lg text-slate-300">{GUIDE_SUBTITLE}</p>
        <div className="mt-4 space-y-3 text-base text-slate-300">
          {GUIDE_INTRO.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={GUIDE_DOWNLOAD_PATH}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow"
          >
            <Download className="h-4 w-4" /> Download the checklist (.txt)
          </a>
          <a
            href={footer.phoneHref}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/5"
          >
            <PhoneCall className="h-4 w-4" /> Call {footer.phone}
          </a>
        </div>

        <ol className="mt-12 space-y-10">
          {GUIDE_ITEMS.map((item, i) => (
            <li key={item.title}>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                {i + 1}. {item.title}
              </h2>
              <p className="mt-2 text-base text-slate-300">{item.why}</p>
              <ul className="mt-3 space-y-2">
                {item.checks.map((check) => (
                  <li key={check} className="flex gap-3 text-base text-slate-200">
                    <span aria-hidden="true" className="mt-1 inline-block h-4 w-4 shrink-0 rounded border border-brand-300/60" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <section className="mt-12 rounded-2xl bg-surface-elevated p-6 ring-1 ring-white/10">
          <h2 className="text-xl font-semibold text-white">The 2-minute test</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-base text-slate-300">
            {GUIDE_QUICK_TEST.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-slate-400">
            If any answer is &quot;no&quot;, that&apos;s the first thing to fix.
          </p>
        </section>

        <section className="mt-12 rounded-2xl p-6 ring-1 ring-white/10">
          <h2 className="text-xl font-semibold text-white">Get a copy by email</h2>
          <p className="mt-2 text-sm text-slate-400">We&apos;ll email you this checklist so you have it later.</p>
          <GuideEmailForm source="guide_page" />
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-white">Want a second pair of eyes?</h2>
          <p className="mt-2 text-base text-slate-300">
            Run the{" "}
            <Link href="/free-website-audit" className="font-semibold text-brand-300 hover:underline">
              free website audit
            </Link>{" "}
            on your site, or call Sitesinc at{" "}
            <a href={footer.phoneHref} className="font-semibold text-brand-300 hover:underline">
              {footer.phone}
            </a>
            . No charge for the audit, no sales call unless you ask for one.
          </p>
        </section>
      </article>
    </SitePage>
  );
}
