import { appendProject, findProjectByLeadId, newId, stableId } from "@/lib/store";
import { conversionEvent } from "./conversions";
import { applyConfigToProject, buildClientConfig } from "./client-config";
import type { IntakeConfigInput } from "./client-config";
import { initClientWorkspace } from "./client-workspace";
import { queueAutoClientBaseline } from "./client-automation";
import type { IntakeProject } from "./types";
import { updateExistingWorkspace } from "./workspace";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create (or reuse) a CRM client project with structured config, bind template + design,
 * and initialize a per-client factory workspace. Does NOT use FACTORY_PROJECT_ID as the build target.
 * Optionally mirrors a lightweight intake event into the Sitesinc workspace when that doc exists.
 */
export async function recordIntakeProject(
  input: IntakeConfigInput & {
    source: "inquiry" | "subscribe" | "factory_intake";
    label: string;
    leadId?: string;
    /** Preview host for auto baseline (request origin). Never invent if missing. */
    hostOrigin?: string | null;
  }
): Promise<IntakeProject> {
  if (input.leadId) {
    const existing = await findProjectByLeadId(input.leadId);
    if (existing) {
      return {
        id: existing.id,
        source: existing.source,
        createdAt: existing.createdAt,
        label: existing.label,
        factoryProjectId: existing.factoryWorkspaceId || existing.id,
        leadId: existing.leadId,
        monitoringInterest: existing.monitoringInterest ?? input.monitoringInterest,
      };
    }
  }

  const config = buildClientConfig({
    ...input,
    name: input.name || input.label,
    monitoringInterest: input.monitoringInterest,
  });

  const id = input.leadId ? await stableId("proj", `lead:${input.leadId}`) : newId("proj");
  const base = {
    id,
    source: input.source,
    createdAt: nowIso(),
    label: (input.label || config.businessName).slice(0, 160),
    leadId: input.leadId,
    monitoringInterest: config.monitoringInterest,
  };
  const stored = await appendProject(applyConfigToProject(base, config));

  try {
    const init = await initClientWorkspace(stored.id, config, {
      hostOrigin: input.hostOrigin,
    });
    // Public intake must stay fast - baseline runs after response via after()/fire-and-forget.
    if (init.created) {
      queueAutoClientBaseline(stored.id, input.hostOrigin);
    }
  } catch (err) {
    console.error("Client factory workspace init FAILED (CRM project is saved):", err);
  }

  const project: IntakeProject = {
    id: stored.id,
    source: stored.source,
    createdAt: stored.createdAt,
    label: stored.label,
    factoryProjectId: stored.id,
    leadId: stored.leadId,
    monitoringInterest: stored.monitoringInterest,
  };

  try {
    const mirrored = await updateExistingWorkspace((workspace) => {
      workspace.intakeProjects = [project, ...workspace.intakeProjects].slice(0, 200);
      workspace.conversions.events = [
        conversionEvent("internal_project", "/app", project.id),
        conversionEvent("intake_success", input.source, project.label),
        ...workspace.conversions.events,
      ].slice(0, 400);
      return workspace;
    });
    if (mirrored === null) {
      console.warn(
        "Factory workspace mirror SKIPPED: no Sitesinc workspace document exists yet. " +
          "The lead and client project are saved in the CRM; client workspace init was attempted separately."
      );
    }
  } catch (err) {
    console.error("Factory workspace mirror write FAILED (CRM record is saved):", err);
  }

  return project;
}
