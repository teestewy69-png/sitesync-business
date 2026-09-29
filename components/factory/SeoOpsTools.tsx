import ActionForm from "@/components/factory/ActionForm";
import BacklinkForm from "@/components/factory/BacklinkForm";
import { Pill } from "@/components/factory/Shell";
import type { FactoryWorkspace } from "@/lib/factory/types";
import type { PreflightItem } from "@/lib/factory/preflight";

export default function SeoOpsTools({
  workspace,
  preflight,
}: {
  workspace: FactoryWorkspace;
  preflight: PreflightItem[];
}) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold">Technical preflight</h2>
        <p className="mt-1 text-sm text-slate-400">Same checks as before, now inside SEO Intelligence.</p>
        <ul className="mt-3 space-y-2">
          {preflight.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm">
              <Pill tone={item.status === "fail" ? "warn" : item.status === "pass" ? "ok" : "muted"}>
                {item.status}
              </Pill>{" "}
              <strong>{item.label}.</strong> {item.detail}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Indexing (verified, not assumed)</h2>
        <p className="mt-1 text-sm text-slate-400">
          Submitting a sitemap does not mean the URL is indexed. Indexed is only set after Search
          Console inspection.
        </p>
        <div className="mt-3 flex gap-2">
          <ActionForm op="submit-indexing" label="Mark published URLs submitted" fields={{ approvedBy: "operator" }} />
          <ActionForm op="verify-indexing" label="Verify via Search Console or sitemap" tone="muted" />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Last checked</th>
              </tr>
            </thead>
            <tbody>
              {workspace.indexing.map((row) => (
                <tr key={row.path} className="border-t border-white/10">
                  <td className="px-3 py-2">{row.path}</td>
                  <td className="px-3 py-2">{row.state}</td>
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2">{row.lastChecked ? row.lastChecked.slice(0, 16) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Backlinks (documented only)</h2>
        {workspace.backlinks.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {workspace.backlinks.map((link) => (
              <li key={link.id} className="rounded-xl border border-white/10 px-4 py-3">
                {link.referringDomain} → {link.destinationUrl} ({link.status}) · {link.acquisitionMethod} ·{" "}
                {link.discoveredDate}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            None documented. Empty on purpose — we do not invent referring domains.
          </p>
        )}
        <BacklinkForm />
      </section>
    </div>
  );
}
