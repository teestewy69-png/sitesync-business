/** Flip-mode persistence + stage runner. One doc per flip project: factory/flip/<projectId>. */
import { readDoc, writeDoc } from "@/lib/persistence";
import type { ClientProject } from "@/lib/store";
import { describeLlmProvider } from "@/lib/city-launch/llm";
import { pickCities } from "../city-launch";
import {
  addLedgerEntry,
  FLIP_STAGE_ORDER,
  newFlipState,
  recordSnapshot,
  runContentStage,
  runDataRecordingStage,
  runHandoffStage,
  runMonetizationStage,
  runTrafficStage,
  type FlipStageKey,
  type FlipState,
} from "./model";
import { flipPresetFor } from "./presets";
import { buildSocialDrafts } from "./sitegrow";

export const flipKey = (projectId: string) => `factory/flip/${projectId.replace(/[^a-z0-9_-]/gi, "")}`;

export async function readFlipState(projectId: string): Promise<FlipState | null> {
  const doc = await readDoc<FlipState>(flipKey(projectId));
  return doc?.value || null;
}

export async function writeFlipState(state: FlipState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await writeDoc(flipKey(state.projectId), state);
}

export async function initFlipState(project: ClientProject, opts: { launchDate?: string; ga4MeasurementId?: string; gscProperty?: string; adsensePublisherId?: string; test?: boolean }): Promise<{ state: FlipState; created: boolean }> {
  const existing = await readFlipState(project.id);
  if (existing) return { state: existing, created: false };
  const state = newFlipState({
    projectId: project.id,
    businessName: project.businessName || project.label,
    domain: project.ownedDomain || "",
    niche: project.niche || "",
    launchDate: opts.launchDate,
    ga4MeasurementId: opts.ga4MeasurementId,
    gscProperty: opts.gscProperty,
    adsensePublisherId: opts.adsensePublisherId,
    test: opts.test,
  });
  await writeFlipState(state);
  return { state, created: true };
}

export function runFlipStageSync(state: FlipState, key: FlipStageKey, project: ClientProject, input: { bodies?: Record<string, string>; cityLimit?: number } = {}): FlipState {
  if (key === "traffic") {
    const preset = flipPresetFor(state.niche);
    const picked = pickCities(project, { mode: "top_states", states: preset.states, limit: input.cityLimit || 50 });
    return runTrafficStage(state, picked.ok ? picked.cities : [], { cityLaunchReady: describeLlmProvider(process.env).configured });
  }
  if (key === "content") return runContentStage(state, input.bodies || {});
  if (key === "monetization") return runMonetizationStage(state);
  if (key === "data_recording") return runDataRecordingStage(state, { gscTokenPresent: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN) });
  const out = runHandoffStage(state);
  out.socialDrafts = buildSocialDrafts(out);
  return out;
}

export async function runFlipStages(project: ClientProject, keys: FlipStageKey[] | "all", input: { bodies?: Record<string, string>; cityLimit?: number } = {}): Promise<FlipState> {
  const state = await readFlipState(project.id);
  if (!state) throw new Error("Flip project not initialized (run flip-init).");
  const order = keys === "all" ? FLIP_STAGE_ORDER : FLIP_STAGE_ORDER.filter((k) => keys.includes(k));
  for (const key of order) runFlipStageSync(state, key, project, input);
  if (!state.socialDrafts.length && state.traffic.contentPlan.length) state.socialDrafts = buildSocialDrafts(state);
  await writeFlipState(state);
  return state;
}

export { addLedgerEntry, recordSnapshot };
