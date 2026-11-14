import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "@/components/SitePage";
import { CHECKLIST, CHECKLIST_PDF_PATH } from "@/lib/lead-magnet";
import content from "@/content.json";

export const metadata: Metadata = {
  title: "The New Business Website Starter Checklist | Sitesinc",
  description:
    "What to decide before you build, what to gather, the pages a starter site needs, Google Business Profile basics, cost traps to avoid, and a launch-day checklist.",
  robots: { index: false, follow: false },
};

export default function ChecklistPage() {
  return (
    <SitePage>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Free checklist
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{CHECKLIST.title}</h1>
        <p className="mt-2 text-base text-slate-400">{CHECKLIST.subtitle}</p>
        <p className="mt-4 text-base text-slate-300">{CHECKLIST.intro}</p>

        <p className="mt-6">
          <a
            href={CHECKLIST_PDF_PATH}
            className="inline-flex rounded-xl border border-brand-300/50 px-5 py-2.5 text-sm font-semibold text-brand-200 transition hover:bg-brand-500/10"
          >
            Download the PDF copy
          </a>
        </p>

        {CHECKLIST.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="mt-12 text-2xl font-semibold">{section.heading}</h2>
            <ul className="mt-4 space-y-3">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-200"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border border-brand-300/70"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="mt-12 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-6 text-sm leading-relaxed text-slate-200">
          {CHECKLIST.closing}
        </p>

        <p className="mt-8 text-sm text-slate-400">
          Didn&apos;t sign up yet?{" "}
          <Link href="/start" className="font-medium text-brand-300 hover:underline">
            Get the checklist by email
          </Link>{" "}
          so you can keep it. Questions: {content.footer.email} · {content.footer.phone}
        </p>
      </section>
    </SitePage>
  );
}
