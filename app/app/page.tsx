import ActionForm from "@/components/factory/ActionForm";
import CaptureButton from "@/components/factory/CaptureButton";
import FactoryShell, { Pill } from "@/components/factory/Shell";
import { PRODUCTION_ORIGIN } from "@/lib/factory/pipeline";
import { latestBaseline, readWorkspace } from "@/lib/factory/workspace";

export default async function FactoryHome() {
  const workspace = await readWorkspace();
  const baseline = await latestBaseline();

  return (
    <FactoryShell title="Sitesinc Growth Case Study">
      <p className="max-w-3xl text-base text-slate-300">
        Internal factory project linked to {workspace.project.productionUrl}. Production homepage stays live.
        Staging is noindex. This is a 90-day living study — Day 0 is the baseline, not a one-day makeover.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Project</p>
          <p className="mt-1 font-semibold">{workspace.project.name}</p>
          <p className="text-sm text-slate-400">{workspace.project.id}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Latest baseline</p>
          <p className="mt-1 font-semibold">{baseline ? baseline.capturedAt.slice(0, 19) : "Not captured"}</p>
          <p className="text-sm text-slate-400">{baseline ? `${baseline.pageInventory.length} pages` : "Required before research"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Study horizon</p>
          <p className="mt-1 font-semibold">{workspace.study.horizonDays} days</p>
          <p className="text-sm text-slate-400">Started {workspace.study.startedAt.slice(0, 10)}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <CaptureButton origin={PRODUCTION_ORIGIN} />
        <ActionForm op="advance-research" label="Complete research + blueprint" fields={{ approvedBy: "operator" }} />
        <ActionForm op="kickoff-to-staging" label="Run briefs → drafts → staging" fields={{ approvedBy: "operator" }} />
        <ActionForm
          op="kickoff-to-publish"
          label="Stage → convert-check → publish → submit"
          fields={{
            approvedBy: "operator",
            origin: process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000",
          }}
        />
        <ActionForm
          op="record-intake"
          label="Convert intake → internal project"
          tone="muted"
          fields={{ source: "factory_intake", label: "Operator factory intake (no PII)" }}
        />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Pipeline</h2>
      <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10">
        {workspace.stages.map((stage) => (
          <div key={stage.key} className="grid gap-3 px-4 py-4 md:grid-cols-[2rem_1fr_auto]">
            <span className="text-sm text-slate-500">{stage.order}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{stage.name}</p>
                <Pill tone={stage.status === "complete" || stage.status === "approved" ? "ok" : "muted"}>
                  {stage.status}
                </Pill>
              </div>
              <p className="mt-1 text-sm text-slate-400">Needs: {stage.requiredInputs.join(" · ")}</p>
              {stage.artifacts.length ? (
                <p className="mt-1 text-sm text-slate-500">Artifacts: {stage.artifacts.join(", ")}</p>
              ) : null}
              {stage.notes ? <p className="mt-1 text-sm text-slate-400">{stage.notes}</p> : null}
              <p className="mt-1 text-xs text-slate-600">
                Approval: {stage.operatorApproval ? `${stage.approvedBy} @ ${stage.approvedAt.slice(0, 16)}` : "required"}
                {stage.completedAt ? ` · Done ${stage.completedAt.slice(0, 16)}` : ""}
              </p>
            </div>
            <ActionForm
              op="approve-stage"
              label="Approve"
              tone="muted"
              fields={{ key: stage.key, approvedBy: "operator" }}
            />
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Visible gaps (not hidden)</h2>
      <ul className="mt-3 space-y-2">
        {workspace.visibleGaps.map((gap) => (
          <li key={gap.id} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">
            <Pill>{gap.area}</Pill>{" "}
            <span className="font-medium text-white">{gap.owner}</span> — {gap.detail}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold">90-day checkpoints</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {workspace.study.checkpoints.map((item) => (
          <div key={item.day} className="rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{item.label}</p>
              <Pill tone={item.status === "complete" ? "ok" : "warn"}>{item.status}</Pill>
            </div>
            <p className="mt-1 text-sm text-slate-400">Due {item.dueDate.slice(0, 10)}</p>
            <p className="mt-2 text-sm text-slate-300">{item.notes}</p>
          </div>
        ))}
      </div>
    </FactoryShell>
  );
}
