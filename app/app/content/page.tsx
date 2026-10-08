import Link from "next/link";
import ActionForm from "@/components/factory/ActionForm";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { readWorkspace } from "@/lib/factory/workspace";

export default async function ContentPage() {
  const workspace = await readWorkspace();
  return (
    <FactoryShell title="Content briefs and drafts">
      <p className="text-base text-slate-300">
        A brief is required before drafting. Human approval is required before staging. Word counts are guidance.
      </p>
      <div className="mt-8 space-y-6">
        {workspace.briefs.map((brief) => {
          const page = workspace.pages.find((item) => item.slug === brief.slug);
          return (
            <section key={brief.id} className="rounded-2xl border border-white/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{brief.title}</h2>
                <Pill tone={brief.status === "approved" ? "ok" : "warn"}>{brief.status}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                <strong>Intent:</strong> {brief.searchIntent}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Words {brief.wordCountGuidance.min}–{brief.wordCountGuidance.max} — {brief.wordCountGuidance.note}
              </p>
              <p className="mt-1 text-sm text-slate-400">Competitors: {brief.competitorUrls.join(" · ")}</p>
              <p className="mt-2 text-sm text-slate-300">Gaps: {brief.gaps.join(" ")}</p>
              <ol className="mt-2 list-decimal pl-5 text-sm text-slate-300">
                {brief.outline.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionForm op="approve-brief" label="Approve brief" fields={{ id: brief.id, approvedBy: "operator" }} />
                <ActionForm op="draft-page" label="Draft from brief" tone="muted" fields={{ slug: brief.slug }} />
                <ActionForm op="approve-page" label="Approve draft" fields={{ slug: brief.slug, approvedBy: "operator" }} />
              </div>
              {page ? (
                <p className="mt-3 text-sm text-slate-400">
                  Page {page.path}: {page.status}
                  {page.wordCount ? ` · ${page.wordCount} words` : ""}
                  {page.status === "staged" || page.status === "published" ? (
                    <>
                      {" "}
                      · <Link href={`/app/staging/${page.slug}`} className="text-brand-300">Staging</Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </FactoryShell>
  );
}
