import { NextRequest, NextResponse } from "next/server";
import { CHECKLIST_DECISIONS } from "@/lib/factory/checklist-model";
import { mergeChecklist, readChecklist, writeChecklist } from "@/lib/factory/checklist";
import { FACTORY_PROJECT_ID } from "@/lib/factory/types";
import type { OperatorChecklist } from "@/lib/factory/types";
import { readWorkspace } from "@/lib/factory/workspace";
import { asNonEmptyString } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanProjectId(value: unknown) {
  const safe = asNonEmptyString(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || FACTORY_PROJECT_ID;
}

async function projectMeta(projectId: string, fallbackName: unknown) {
  const workspace = await readWorkspace();
  if (projectId === workspace.project.id) {
    return { id: workspace.project.id, name: workspace.project.name };
  }
  // Unknown ids get their own checklist file; they never fall back to the main project's data.
  return { id: projectId, name: asNonEmptyString(fallbackName, 120) || projectId };
}

export async function GET(req: NextRequest) {
  const projectId = cleanProjectId(req.nextUrl.searchParams.get("projectId"));
  const project = await projectMeta(projectId, req.nextUrl.searchParams.get("projectName"));
  const checklist = await readChecklist(project.id, project.name);
  return NextResponse.json({ ok: true, checklist });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    checklist?: OperatorChecklist;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }
  if (!body.checklist || typeof body.checklist !== "object" || !Array.isArray(body.checklist.sections)) {
    return NextResponse.json({ ok: false, error: "Checklist payload with sections required." }, { status: 400 });
  }
  if (body.checklist.finalDecision && !CHECKLIST_DECISIONS.includes(body.checklist.finalDecision)) {
    return NextResponse.json({ ok: false, error: "Unknown final decision." }, { status: 400 });
  }
  try {
    const project = await projectMeta(cleanProjectId(body.projectId), body.checklist.projectName);
    const merged = mergeChecklist(
      { ...body.checklist, projectId: project.id, projectName: project.name },
      project.id,
      project.name
    );
    const checklist = await writeChecklist(merged);
    return NextResponse.json({ ok: true, checklist });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Could not save checklist." },
      { status: 500 }
    );
  }
}
