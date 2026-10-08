import { Pill } from "@/components/factory/Shell";
import SeoWorkspace, { siteFromSearchParams } from "@/components/factory/SeoWorkspace";

export const dynamic = "force-dynamic";

const IMPLEMENTED = [
  "missing title",
  "missing / weak meta",
  "duplicate title or meta",
  "missing or multiple H1",
  "missing / mismatched canonical",
  "noindex on crawled pages",
  "broken internal links from the baseline sample",
];

const NOT_IMPLEMENTED = [
  "JavaScript-rendered meta that the crawler missed",
  "hreflang / international targeting",
  "Core Web Vitals field data",
  "Keyword cannibalization from Search Console queries",
];

export default async function SeoIssuesPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const siteId = await siteFromSearchParams(searchParams);
  return (
    <SeoWorkspace siteId={siteId}>
      {(model) => (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Diagnostics</h2>
            <p className="mt-1 text-sm text-slate-400">
              {model.summary.issueFails} failing · {model.summary.issueWarns} warnings from implemented checks.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="rounded-xl border border-white/10 p-4">
              <p className="font-semibold">Implemented</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                {IMPLEMENTED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <p className="font-semibold">Not implemented (not implied)</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-500">
                {NOT_IMPLEMENTED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          {model.issues.length ? (
            <ul className="space-y-2">
              {model.issues.map((issue) => (
                <li key={issue.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm">
                  <Pill tone={issue.severity === "fail" ? "warn" : "muted"}>{issue.severity}</Pill>{" "}
                  <strong>{issue.type}</strong> · {issue.path}
                  <span className="mt-1 block text-slate-400">{issue.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No implemented diagnostics fired. Capture a baseline if the inventory is empty.</p>
          )}
        </div>
      )}
    </SeoWorkspace>
  );
}
