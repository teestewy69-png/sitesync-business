import Link from "next/link";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { latestBaseline, readWorkspace } from "@/lib/factory/workspace";

export default async function InternalCaseStudy() {
  const workspace = await readWorkspace();
  const baseline = await latestBaseline();
  const published = workspace.pages.filter((page) => page.status === "published");
  return (
    <FactoryShell title="Living case study">
      <p className="text-base text-slate-300">
        Real dated evidence only. Outcome metrics that do not exist yet are labeled in progress. Public view:{" "}
        <Link href="/case-study" className="text-brand-300">
          /case-study
        </Link>
        .
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-5">
          <h2 className="font-semibold">Before</h2>
          {baseline ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              <li>Captured {baseline.capturedAt}</li>
              <li>{baseline.pageInventory.length} URLs inventoried</li>
              <li>Sitemap {baseline.sitemap.ok ? "present" : "missing"}</li>
              <li>Avg TTFB {baseline.performance.avgTtfbMs ?? "—"}ms (fetch only)</li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-amber-200">No Day 0 baseline yet.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 p-5">
          <h2 className="font-semibold">After</h2>
          <p className="mt-3 text-sm text-slate-300">
            {published.length} factory pages published in-repo. Homepage still the original production page.
          </p>
          <p className="mt-2 text-sm text-amber-100">
            <Pill tone="warn">in progress</Pill> Day 30/60/90 recrawls and Search Console index counts are not
            complete. Do not treat this as a finished after-state.
          </p>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="font-semibold">Factory process</h2>
        <ol className="mt-3 space-y-1 text-sm text-slate-300">
          {workspace.stages.map((stage) => (
            <li key={stage.key}>
              {stage.order}. {stage.name} — {stage.status}
              {stage.completedAt ? ` (${stage.completedAt.slice(0, 10)})` : ""}
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-8">
        <h2 className="font-semibold">Content produced</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {workspace.pages.map((page) => (
            <li key={page.slug}>
              {page.path} · {page.status} · {page.wordCount || 0} words
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-semibold">Indexing / backlinks / conversions</h2>
        <p className="mt-2 text-sm text-slate-300">
          Index rows with last check: {workspace.indexing.filter((row) => row.lastChecked).length}/
          {workspace.indexing.length}. Backlinks documented: {workspace.backlinks.length}. Intake → internal
          projects: {workspace.intakeProjects.length}.
        </p>
      </section>
    </FactoryShell>
  );
}
