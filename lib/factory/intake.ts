import { recordIntakeProject } from "./record-intake";
import type { IntakeConfigInput } from "./client-config";

export async function intakeToProject(
  source: "inquiry" | "subscribe",
  publicLabel: string,
  leadId?: string,
  monitoringInterest?: boolean,
  extras?: Omit<IntakeConfigInput, "label" | "source" | "monitoringInterest">
) {
  try {
    return await recordIntakeProject({
      source,
      label: publicLabel,
      leadId,
      monitoringInterest,
      ...extras,
    });
  } catch (err) {
    console.error("Factory intake project failed:", err);
    return null;
  }
}
