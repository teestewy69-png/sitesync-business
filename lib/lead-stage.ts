/** Operator-only pipeline stage for leads, inquiries and projects. Never shown on public pages. */
export const LEAD_STAGES = ["new", "in_progress", "paid", "done", "closed"] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const DEFAULT_LEAD_STAGE: LeadStage = "new";

const LABELS: Record<LeadStage, string> = {
  new: "New",
  in_progress: "In progress",
  paid: "Paid",
  done: "Done",
  closed: "Closed",
};

export function isLeadStage(value: unknown): value is LeadStage {
  return typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value);
}

export function stageLabel(stage: LeadStage): string {
  return LABELS[stage];
}

export function stageOf(record: { stage?: unknown }): LeadStage {
  return isLeadStage(record.stage) ? record.stage : DEFAULT_LEAD_STAGE;
}
