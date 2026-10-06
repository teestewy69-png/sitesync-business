/**
 * City Launch quality gate (replaces the old blanket "no city doorway clones" rule).
 * Multi-city pages are allowed only when each page is genuinely unique and locally specific:
 *   - near-duplicate check across all of the client's city pages (masked shingle overlap, see similarity.ts)
 *   - minimum substance (word count), the city actually named, no unfilled placeholders
 *   - at least one local reference beyond the city name (county, a nearby city, or the business base)
 * "block" = cannot be approved or published. "warn" = approval allowed, flagged for a closer read.
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */
import type { CityDraft, GateResult } from "./job";
import { contentText, countWords } from "./prompts";
import { checkUniqueness, DEFAULT_BLOCK_THRESHOLD, DEFAULT_WARN_THRESHOLD } from "./similarity";

export const MIN_PUBLISH_WORDS = 300;

export type GateOptions = {
  blockThreshold?: number;
  warnThreshold?: number;
  minWords?: number;
  baseCity?: string;
  now?: string;
  businessName?: string;
  /** Fallback business facts when a draft carries none (the client's default website context). */
  businessContext?: string;
};

/**
 * Business claims an LLM tends to invent. A claim made in the business's own voice ("we", "our", the business name)
 * blocks the page unless the business context the operator provided supports it.
 */
export const BUSINESS_CLAIMS: Array<{ label: string; re: RegExp; support: RegExp }> = [
  { label: "licensed", re: /\blicen[sc]ed\b|\blicense (number|#)/i, support: /licen[sc]/i },
  { label: "insured / bonded", re: /\b(insured|bonded)\b/i, support: /insured|bonded|insurance/i },
  { label: "certified", re: /\bcertified\b/i, support: /certified|certification/i },
  { label: "guarantee / warranty", re: /\bguarantee(d|s)?\b|\bwarrant(y|ies|ied)\b/i, support: /guarantee|warrant/i },
  { label: "years in business", re: /\b\d+\+?\s+years (of|in)\b|\bsince (19|20)\d\d\b|\bdecades? of (experience|service)\b/i, support: /\byears?\b|since (19|20)\d\d|decade/i },
  { label: "awards / ratings / reviews", re: /\baward|\b(five|5)[- ]star|\btop[- ]rated\b|\bbbb\b|\bA\+ rat/i, support: /award|star|rated|bbb|review/i },
  { label: "free estimates", re: /\bfree (estimate|quote|inspection|consultation)s?\b/i, support: /free (estimate|quote|inspection|consultation)/i },
  { label: "24/7 / same-day", re: /\b24\/7\b|\b24 hours\b|around the clock|\bsame[- ]day\b/i, support: /24\/7|24 hours|around the clock|same[- ]day/i },
  { label: "discounts / prices", re: /\b\d+% off\b|\bdiscount|\$\s?\d/i, support: /%|discount|\$/i },
  { label: "family-owned", re: /\bfamily[- ]owned\b|\blocally owned\b/i, support: /family|locally owned/i },
];

/** Claims made in the business's own voice that the business context does not support. */
export function unsupportedClaims(text: string, context: string, businessName = ""): string[] {
  const voice = new RegExp(`\\b(we|we're|we've|we'll|our|ours|us)\\b${businessName ? `|${businessName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` : ""}`, "i");
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => voice.test(s));
  const found: string[] = [];
  for (const claim of BUSINESS_CLAIMS) {
    if (claim.support.test(context)) continue;
    const hit = sentences.find((s) => claim.re.test(s));
    if (hit) found.push(`${claim.label}: "${hit.trim().slice(0, 140)}"`);
  }
  return found;
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
    const isBase = Boolean(opts.baseCity) && opts.baseCity!.toLowerCase() === d.city.name.toLowerCase();
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
    if (!isBase && /\bour (city|town|community|neighbou?rs|neighbou?rhoods?)\b/i.test(text)) {
      if (status === "pass") status = "warn";
      reasons.push(`Implies the business is based in ${d.city.name} ("our city/community"). Fix the wording before approving.`);
    }
    const claims = unsupportedClaims(text, d.businessContext ?? opts.businessContext ?? "", opts.businessName);
    if (claims.length) {
      status = "block";
      reasons.push(`Unverified business claim (not in the business context): ${claims.join("; ")}. Edit it out, or add the fact to the business context and regenerate.`);
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
