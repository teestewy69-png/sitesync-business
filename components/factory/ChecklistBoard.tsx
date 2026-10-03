"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/factory/Shell";
import { checklistProgress, derivedStatus } from "@/lib/factory/checklist-model";
import type {
  ChecklistFinalDecision,
  ChecklistSectionStatus,
  OperatorChecklist,
} from "@/lib/factory/types";

const STATUS_OPTIONS: ChecklistSectionStatus[] = ["not_started", "in_progress", "complete"];
const DECISIONS: { value: ChecklistFinalDecision; label: string }[] = [
  { value: "good_enough", label: "Good enough to send traffic" },
  { value: "cleanup_pass", label: "Needs one cleanup pass" },
  { value: "major_fix", label: "Needs major fix before traffic" },
];

function toneFor(status: ChecklistSectionStatus) {
  if (status === "complete") return "ok" as const;
  if (status === "in_progress") return "warn" as const;
  return "muted" as const;
}

export default function ChecklistBoard({ initial }: { initial: OperatorChecklist }) {
  const [checklist, setChecklist] = useState(initial);
  const [saveState, setSaveState] = useState("Saved in the factory store.");
  const [saveError, setSaveError] = useState(false);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useMemo(() => checklistProgress(checklist), [checklist]);

  function persist(updater: (current: OperatorChecklist) => OperatorChecklist) {
    const optimistic = updater(latest.current);
    latest.current = optimistic;
    setChecklist(optimistic);
    setSaveError(false);
    setSaveState("Saving...");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const payload = latest.current;
      try {
        const res = await fetch("/api/factory/checklist", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: payload.projectId, checklist: payload }),
        });
        if (res.status === 401) throw new Error("Session expired. Sign in again, then retry.");
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          checklist?: OperatorChecklist;
          error?: string;
        } | null;
        if (!res.ok || !data?.ok || !data.checklist) {
          throw new Error(data?.error || `Save failed (HTTP ${res.status}).`);
        }
        // Only adopt the server copy if nothing was edited while the request was in flight.
        if (latest.current === payload) {
          latest.current = data.checklist;
          setChecklist(data.checklist);
        }
        setSaveError(false);
        setSaveState(`Saved ${data.checklist.updatedAt.slice(0, 16).replace("T", " ")} UTC`);
      } catch (err) {
        setSaveError(true);
        setSaveState(`Not saved: ${err instanceof Error ? err.message : "network error"}`);
      }
    }, 250);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Tied to project</p>
            <p className="font-semibold">{checklist.projectName}</p>
            <p className="text-sm text-slate-400">{checklist.projectId}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">
              {progress.done} / {progress.total} items - {progress.completeSections} / {progress.totalSections} sections
            </p>
            <p className={`text-xs ${saveError ? "text-rose-300" : "text-slate-400"}`} role="status">
              {saveState}
              {saveError ? (
                <button
                  type="button"
                  onClick={() => persist((current) => current)}
                  className="ml-2 underline hover:text-white"
                >
                  Retry save
                </button>
              ) : null}
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-brand-300 to-brand-600"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {checklist.sections.map((section) => (
        <section key={section.id} className="rounded-2xl border border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <Pill tone={toneFor(section.status)}>{section.status.replace("_", " ")}</Pill>
              </div>
              {section.href ? (
                <Link href={section.href} className="text-xs text-brand-300 hover:text-white">
                  Open related factory view
                </Link>
              ) : null}
            </div>
            <label className="text-xs text-slate-400">
              Section status
              <select
                value={section.status}
                onChange={(event) => {
                  const status = event.target.value as ChecklistSectionStatus;
                  persist((current) => ({
                    ...current,
                    sections: current.sections.map((row) =>
                      row.id === section.id ? { ...row, status } : row
                    ),
                  }));
                }}
                className="ml-2 rounded-lg border border-white/10 bg-black px-2 py-1 text-sm text-white"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="mt-4 space-y-2">
            {section.items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      persist((current) => ({
                        ...current,
                        sections: current.sections.map((row) => {
                          if (row.id !== section.id) return row;
                          const items = row.items.map((entry) =>
                            entry.id === item.id ? { ...entry, checked } : entry
                          );
                          return { ...row, items, status: derivedStatus(items) };
                        }),
                      }));
                    }}
                    className="mt-0.5 h-4 w-4 accent-brand-400"
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>

          <label className="mt-4 block text-xs text-slate-400">
            Friction, issues, next actions
            <textarea
              value={section.notes}
              onChange={(event) => {
                const notes = event.target.value;
                persist((current) => ({
                  ...current,
                  sections: current.sections.map((row) =>
                    row.id === section.id ? { ...row, notes } : row
                  ),
                }));
              }}
              rows={section.id === "final" ? 6 : 3}
              placeholder="What slowed you down, what broke, what to fix next..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder:text-slate-600"
            />
          </label>

          {section.id === "final" ? (
            <label className="mt-4 block text-xs text-slate-400">
              Final decision
              <select
                value={checklist.finalDecision}
                onChange={(event) => {
                  const finalDecision = event.target.value as ChecklistFinalDecision;
                  persist((current) => ({ ...current, finalDecision }));
                }}
                className="mt-1 block w-full max-w-md rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
              >
                <option value="">Not decided yet</option>
                {DECISIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      ))}
    </div>
  );
}
