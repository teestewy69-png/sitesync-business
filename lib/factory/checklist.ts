import { isStoreConflict, listDocKeys, readDoc, writeDoc } from "@/lib/persistence";
import { mergeChecklist, seedChecklist } from "./checklist-model";
import { FACTORY_PROJECT_ID } from "./types";
import type { OperatorChecklist } from "./types";

export { checklistProgress, derivedStatus, mergeChecklist, seedChecklist } from "./checklist-model";

/** Durable key: factory/checklists/<project> (Blobs on Netlify, data/factory/checklists/<project>.json locally). */
export const CHECKLIST_PREFIX = "factory/checklists/";

function keyFor(projectId: string) {
  const safe = projectId.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || FACTORY_PROJECT_ID;
  return `${CHECKLIST_PREFIX}${safe}`;
}

export async function readChecklist(
  projectId = FACTORY_PROJECT_ID,
  projectName = "Sitesinc Growth Case Study"
) {
  // Missing checklist -> code defaults. Unreadable/corrupt data throws instead of being reseeded over.
  const doc = await readDoc<OperatorChecklist>(keyFor(projectId));
  if (!doc) return seedChecklist(projectId, projectName);
  return mergeChecklist(doc.value, projectId, projectName);
}

/**
 * Save the whole checklist document (the client sends the full board, so this is a
 * whole-document replace: if two tabs save, the last save wins). Writes are serialised and
 * version-checked against the store so a concurrent change is never half-applied.
 * Failures throw; the route returns a non-ok response and the board shows "Not saved".
 */
export async function writeChecklist(checklist: OperatorChecklist) {
  const key = keyFor(checklist.projectId);
  const next = { ...checklist, updatedAt: new Date().toISOString() };
  for (let attempt = 1; ; attempt += 1) {
    const current = await readDoc<OperatorChecklist>(key);
    try {
      await writeDoc(key, next, { expectedVersion: current ? current.version : null });
      break;
    } catch (err) {
      if (isStoreConflict(err) && attempt < 30) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(20 * attempt, 150) + Math.floor(Math.random() * 40)));
        continue;
      }
      throw err;
    }
  }
  return readChecklist(checklist.projectId, checklist.projectName);
}

/** Raw stored checklists (for backup/export). Unreadable documents throw rather than being skipped. */
export async function listStoredChecklists(): Promise<OperatorChecklist[]> {
  const keys = await listDocKeys(CHECKLIST_PREFIX);
  const docs = await Promise.all(keys.map((key) => readDoc<OperatorChecklist>(key)));
  return docs.filter((doc): doc is { value: OperatorChecklist; version: string } => Boolean(doc)).map((doc) => doc.value);
}
