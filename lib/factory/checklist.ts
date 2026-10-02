import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeChecklist, seedChecklist } from "./checklist-model";
import { FACTORY_PROJECT_ID } from "./types";
import type { OperatorChecklist } from "./types";

export { checklistProgress, derivedStatus, mergeChecklist, seedChecklist } from "./checklist-model";

const ROOT = path.join(process.cwd(), "data", "factory", "checklists");

let writeChain: Promise<void> = Promise.resolve();

function fileFor(projectId: string) {
  const safe = projectId.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || FACTORY_PROJECT_ID;
  return path.join(ROOT, `${safe}.json`);
}

export async function readChecklist(
  projectId = FACTORY_PROJECT_ID,
  projectName = "Sitesinc Growth Case Study"
) {
  try {
    const raw = await readFile(fileFor(projectId), "utf8");
    const parsed = JSON.parse(raw) as OperatorChecklist;
    return mergeChecklist(parsed, projectId, projectName);
  } catch {
    return seedChecklist(projectId, projectName);
  }
}

export async function writeChecklist(checklist: OperatorChecklist) {
  const run = writeChain.then(async () => {
    await mkdir(ROOT, { recursive: true });
    const next = {
      ...checklist,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(fileFor(checklist.projectId), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  });
  writeChain = run.catch(() => undefined);
  await run;
  return readChecklist(checklist.projectId, checklist.projectName);
}
