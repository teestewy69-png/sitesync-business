/**
 * City Launch quality gate (replaces the old blanket "no city doorway clones" rule).
 * Multi-city pages are allowed only when each page is genuinely unique and locally specific:
 *   - near-duplicate check across all of the client's city pages (masked shingle overlap, see similarity.ts)
 *   - minimum substance (word count), the city actually named, no unfilled placeholders
 *   - at least one local reference beyond the city name (county, a nearby city, or the business base)
 *   - honesty (honesty.ts): no invented business claims, no "we are located in <non-base city>", no unsourced
 *     local facts (climate, water, soil, housing age, growth...)
 * "block" = cannot be approved or published. "warn" = approval allowed, flagged for a closer read.
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */
import type { CityDraft, GateResult } from "./job";
import { contentText, countWords } from "./prompts";
import { describeIssues, findHonestyIssues, isBaseCity, type HonestyGeo } from "./honesty";
import { checkUniqueness, DEFAULT_BLOCK_THRESHOLD, DEFAULT_WARN_THRESHOLD } from "./similarity";

export { BUSINESS_CLAIMS, findHonestyIssues, unsupportedClaims } from "./honesty";

export const MIN_PUBLISH_WORDS = 300;

export type GateOptions = {
  blockThreshold?: number;
  warnThreshold?: number;
  minWords?: number;
  baseCity?: string;
  baseState?: string;
  /** Coordinates of the page city, the base and its nearest cities, for the distance/direction check. */
  geoFor?: (draft: CityDraft) => HonestyGeo | undefined;
  now?: string;
  businessName?: string;
  /** Fallback business facts when a draft carries none (the client's default website context). */
  businessContext?: string;
};

/** Census 2020 -> 2024 population change in percent, when both numbers are known. */
export function popChangePct(d: Pick<CityDraft, "city">): number | undefined {
  const base = d.city.pop2020 || 0;
  if (!base || !d.city.population) return undefined;
  return Math.round(((d.city.population - base) / base) * 1000) / 10;
}

function countMentions(text: string, term: string): number {
  if (!term) return 0;
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return (text.match(re) || []).length;
}

export function ownMaskTerms(draft: Pick<CityDraft, "city">): string[] {
  const county = draft.city.county || "";
  return [
    draft.city.name,
    draft.city.stateName,
    county,
    county.replace(/\s+(County|Parish|Borough|Municipality|City and Borough|Census Area)$/i, ""),
  ].filter(Boolean);
}

export function evaluateGate(drafts: CityDraft[], opts: GateOptions = {}): Map<string, GateResult> {
  const now = opts.now || new Date().toISOString();
  const minWords = opts.minWords ?? MIN_PUBLISH_WORDS;
  const live = drafts.filter((d) => d.status !== "rejected");
  const globalTerms = new Set<string>();
  for (const d of live) {
    globalTerms.add(d.city.name);
    for (const n of d.nearby || []) globalTerms.add(n.name);
  }
  if (opts.baseCity) globalTerms.add(opts.baseCity);
  const sim = checkUniqueness(
    live.map((d) => ({ slug: d.slug, text: contentText(d.content), maskTerms: ownMaskTerms(d) })),
    {
      blockThreshold: opts.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD,
      warnThreshold: opts.warnThreshold ?? DEFAULT_WARN_THRESHOLD,
      globalMaskTerms: [...globalTerms],
    }
  );
  const bySlug = new Map(sim.map((s) => [s.slug, s]));
  const out = new Map<string, GateResult>();
  for (const d of live) {
    const s = bySlug.get(d.slug);
    const text = contentText(d.content);
    const reasons: string[] = [];
    let status: GateResult["status"] = s?.status || "pass";
    const words = countWords(text);
    if (s?.status === "block") {
      reasons.push(`Near-duplicate of ${s.nearestSlug} (overlap ${s.maxScore} >= ${opts.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD}). Rewrite or regenerate.`);
    } else if (s?.status === "warn") {
      reasons.push(`Shares phrasing with ${s.nearestSlug} (overlap ${s.maxScore}). Read both before approving.`);
    }
    if (words < minWords) {
      status = "block";
      reasons.push(`Thin page: ${words} words (< ${minWords}).`);
    }
    if (countMentions(text, d.city.name) < 2) {
      status = "block";
      reasons.push(`${d.city.name} is named fewer than 2 times - not locally specific.`);
    }
    if (/\{(city|state|keyword)\}/i.test(text)) {
      status = "block";
      reasons.push("Unfilled {placeholder} in copy.");
    }
    const county = (d.city.county || "").replace(/\s+(County|Parish|Borough|Municipality|City and Borough|Census Area)$/i, "");
    const isBase = isBaseCity({ cityName: d.city.name, cityState: d.city.state, baseCity: opts.baseCity, baseState: opts.baseState });
    const refNames = [
      county,
      ...(d.nearby || []).map((n) => n.name),
      opts.baseCity && !isBase ? opts.baseCity : "",
    ].filter((n, i, all) => n && n.toLowerCase() !== d.city.name.toLowerCase() && all.indexOf(n) === i);
    const distinctRefs = refNames.filter((n) => countMentions(text, n) > 0).length;
    if (distinctRefs === 0) {
      if (status === "pass") status = "warn";
      reasons.push("No local reference beyond the city name (county, nearby city, or base city).");
    } else if (distinctRefs < 2) {
      if (status === "pass") status = "warn";
      reasons.push("Only one local reference (county / nearby city / base). Add real local context.");
    }
    const honesty = findHonestyIssues({
      text,
      cityName: d.city.name,
      cityState: d.city.state,
      stateName: d.city.stateName,
      county: d.city.county,
      baseCity: opts.baseCity,
      baseState: opts.baseState,
      businessName: opts.businessName,
      support: d.businessContext ?? opts.businessContext ?? "",
      popChangePct: popChangePct(d),
      geo: opts.geoFor?.(d),
    });
    if (honesty.length) {
      status = "block";
      reasons.push(`${describeIssues(honesty)} Edit it, or regenerate.`);
    }
    if (!d.content.metaDescription) {
      status = "block";
      reasons.push("Missing meta description.");
    }
    out.set(d.slug, {
      status,
      maxScore: s?.maxScore ?? 0,
      nearestSlug: s?.nearestSlug ?? null,
      reasons,
      checkedAt: now,
    });
  }
  return out;
}
