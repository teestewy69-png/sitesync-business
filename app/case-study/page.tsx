import type { Metadata } from "next";
import Link from "next/link";
import { latestBaseline, readWorkspace } from "@/lib/factory/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sitesinc Growth Case Study — in progress",
  description:
    "Living 90-day case study of Sitesinc running through its own website factory. In progress. No ranking, indexing, backlink, or conversion claims.",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "/case-study" },
};

export default async function PublicCaseStudy() {
  const workspace = await readWorkspace();
  const baseline = await latestBaseline();

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">
          In progress · noindex · no ranking or revenue claims
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Sitesinc builds Sitesinc
        </h1>
        <p className="mt-4 text-base text-slate-300">
          This is a 90-day living case study, not a one-day before/after. The public homepage on
          sitesinc.co is unchanged. We do not publish ranking, indexing, backlink, or conversion
          results until those numbers are verified from Search Console or a dated recapture.
        </p>

        <section className="mt-10 rounded-2xl border border-white/10 p-5">
          <h2 className="text-xl font-semibold">Before (Day 0)</h2>
          {baseline ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              <li>
                Live site {baseline.origin} captured {baseline.capturedAt}
              </li>
              <li>{baseline.pageInventory.length} public URLs inventoried</li>
              <li>
                Production robots.txt {baseline.robotsTxt.ok ? "present" : "was missing"} · sitemap{" "}
                {baseline.sitemap.ok ? "present" : "was missing"}
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-amber-100">In progress — Day 0 baseline not captured yet.</p>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 p-5">
          <h2 className="text-xl font-semibold">After</h2>
          <p className="mt-3 text-sm text-amber-100">
            In progress. Factory pages are staged and noindex. Nothing on this page is a finished
            after-state.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 p-5">
          <h2 className="text-xl font-semibold">Timeline</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-300">
            {workspace.study.checkpoints.map((item) => (
              <li key={item.day}>
                {item.label}: {item.status}
                {item.day === 0 && item.capturedAt ? ` · captured ${item.capturedAt.slice(0, 10)}` : ""}
                {item.day !== 0 ? ` · due ${item.dueDate.slice(0, 10)}` : ""}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-xl font-semibold">Not published yet</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Index counts — Search Console is not configured. Status is not assumed.</li>
            <li>Backlinks — none verified as live referring domains.</li>
            <li>Conversions, leads, or revenue — not claimed.</li>
            <li>Rankings — never guaranteed and not reported here.</li>
          </ul>
        </section>

        <p className="mt-10 text-sm text-slate-500">
          Internal operators review evidence in the factory workspace.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          <Link href="/" className="text-brand-300">
            Back to Sitesinc
          </Link>
        </p>
      </div>
    </main>
  );
}
