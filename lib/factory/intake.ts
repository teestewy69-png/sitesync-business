import { recordIntakeProject } from "./actions";

export async function intakeToProject(
  source: "inquiry" | "subscribe",
  publicLabel: string,
  leadId?: string,
  monitoringInterest?: boolean
) {
  try {
    return await recordIntakeProject({
      source,
      label: publicLabel,
      leadId,
      monitoringInterest,
    });
  } catch (err) {
    console.error("Factory intake project failed:", err);
    return null;
  }
}