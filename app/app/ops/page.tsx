import ActionForm from "@/components/factory/ActionForm";
import BacklinkForm from "@/components/factory/BacklinkForm";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { buildPreflight } from "@/lib/factory/preflight";
import { latestBaseline, readWorkspace } from "@/lib/factory/workspace";

export default async function OpsPage() {
  const workspace = await readWorkspace();
  const baseline = await latestBaseline();
  const preflight = buildPreflight(workspace, baseline);
  return (
    <FactoryShell title="Technical SEO, indexing, backlinks">
      <h2 className="text-lg font-semibold">Preflight</h2>
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

      <h2 className="mt-10 text-lg font-semibold">Indexing (verified, not assumed)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Submitting a sitemap does not guarantee indexing. Last checked date and source are required on every row.
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

      <h2 className="mt-10 text-lg font-semibold">Backlinks (documented only)</h2>
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
          None documented. The tracker is empty on purpose — we do not invent referring domains.
        </p>
      )}
      <BacklinkForm />

      <h2 className="mt-10 text-lg font-semibold">Conversions</h2>
      <ActionForm
        op="run-conversions"
        label="Run conversion checks"
        fields={{ origin: process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000", approvedBy: "operator" }}
      />
      {workspace.conversions.launchBlocking ? (
        <p className="mt-2 text-sm text-amber-200">Launch-blocking issues are open. Production publish is refused.</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {workspace.conversions.checks.map((check) => (
          <li key={check.id} className="text-sm text-slate-300">
            <Pill tone={check.ok ? "ok" : "warn"}>{check.severity}</Pill> {check.label}: {check.detail}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-slate-400">
        Intake projects created: {workspace.intakeProjects.length}. Events: {workspace.conversions.events.length}.
      </p>
    </FactoryShell>
  );
}
