import ChecklistBoard from "@/components/factory/ChecklistBoard";
import FactoryShell from "@/components/factory/Shell";
import { readChecklist } from "@/lib/factory/checklist";
import { readWorkspace } from "@/lib/factory/workspace";

export const dynamic = "force-dynamic";

export default async function OperatorQaPage() {
  const workspace = await readWorkspace();
  const checklist = await readChecklist(workspace.project.id, workspace.project.name);

  return (
    <FactoryShell title="Operator QA checklist">
      <p className="max-w-3xl text-base text-slate-300">
        Private operator walkthrough for the Sitesinc self-test (running Sitesinc through its own factory), and for later
        client/project quality checks. Tick items as you go, dump friction in the notes, and leave a
        final traffic decision. This page is not public and stays noindex.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Automated staging QA still lives on{" "}
        <a href="/app/release" className="text-brand-300 hover:text-white">
          QA / release
        </a>
        . SEO Intelligence is{" "}
        <a href="/app/seo" className="text-brand-300 hover:text-white">
          /app/seo
        </a>
        - overview, pages, issues, content refresh, and ops tools. Use this list for the human pass.
      </p>
      <div className="mt-8">
        <ChecklistBoard initial={checklist} />
      </div>
    </FactoryShell>
  );
}
