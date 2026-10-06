/**
 * Sitesinc client -> DomainIQ bridge (pure: no store, no network).
 * Seeds DomainIQ from a client's niche / businessName / city / state, runs a
 * local (descriptive) pass and a brand (DomainIQ brandable) pass, and returns
 * merged candidates carrying DomainIQ's own scores. Never invents availability
 * and never purchases anything.
 */
import type { DomainIQEngine } from "./engine";
import type { DomainIQScoreContext, DomainIQSubScores } from "./types";

export type ClientDomainAvailability = "unchecked" | "available" | "registered" | "error" | "unsupported_tld";

export type ClientDomainStatus =
  | "pending"
  | "candidates_ready"
  | "missing_input"
  | "failed"
  | "selected"
  | "purchase_approved";

export type ClientDomainCandidate = {
  domain: string;
  label: string;
  tld: string;
  /** DomainIQ total score 0-100 (same engine as DomainIQ POST /score). */
  score: number;
  band: string;
  /** local = descriptive pass seeded with city/business; brand = DomainIQ brandable niche pass; operator = typed in. */
  source: "local" | "brand" | "operator";
  pattern: string;
  summary: string;
  explanation: string;
  highlights: string[];
  concerns: string[];
  subScores: DomainIQSubScores;
  nicheKey: string | null;
  availability: ClientDomainAvailability;
  availabilityCheckedAt?: string;
  availabilityDetail?: string;
};

export type ClientDomainSeedInput = {
  businessName?: string;
  niche?: string;
  city?: string;
  state?: string;
};

export type ClientDomainSeed = {
  ok: boolean;
  reason?: string;
  input: Required<ClientDomainSeedInput>;
  nicheKeyword: string;
  cityToken: string;
  businessToken: string;
  distinctiveToken: string;
};

export type AvailabilityResult = {
  domain: string;
  status: ClientDomainAvailability;
  checkedAt: string;
  detail?: string;
};

const STOP_WORDS = new Set([
  "llc", "inc", "co", "corp", "corporation", "company", "the", "and", "of", "ltd", "pllc", "lp",
  "services", "service", "group", "pros", "solutions",
]);

const compact = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
const words = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

function clean(value: unknown, max = 120): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function buildClientDomainSeed(
  raw: ClientDomainSeedInput,
  engine?: Pick<DomainIQEngine, "resolveNiche">
): ClientDomainSeed {
  const input = {
    businessName: clean(raw.businessName),
    niche: clean(raw.niche, 80),
    city: clean(raw.city, 80),
    state: clean(raw.state, 40),
  };
  let nicheKeyword = "";
  let nicheVocabulary: string[] = [];
  if (input.niche) {
    const resolution = engine?.resolveNiche([], input.niche, input.niche);
    const profile = resolution?.source === "curated" ? resolution.profile : null;
    if (profile && /^[a-z]+$/.test(profile.key)) nicheKeyword = profile.key;
    else {
      const nicheCompact = compact(input.niche);
      nicheKeyword =
        nicheCompact.length >= 3 && nicheCompact.length <= 12
          ? nicheCompact
          : words(input.niche).find((w) => w.length >= 3) || "";
    }
    nicheVocabulary = [
      ...words(input.niche),
      ...(profile ? [profile.key, ...profile.aliases.map(compact)] : []),
    ];
  }
  const cityToken = compact(input.city);
  const businessWords = words(input.businessName).filter((w) => !STOP_WORDS.has(w));
  const businessToken = businessWords.join("");
  const nicheish = new Set([nicheKeyword, ...nicheVocabulary, cityToken].filter(Boolean));
  const distinctiveWords = businessWords.filter((w) => !nicheish.has(w) && !nicheish.has(w.replace(/s$/, "")));
  const distinctiveToken = distinctiveWords.join("");

  if (!nicheKeyword && !businessToken) {
    return {
      ok: false,
      reason: "Client has no niche and no business name - DomainIQ needs at least one to seed generation.",
      input,
      nicheKeyword,
      cityToken,
      businessToken,
      distinctiveToken,
    };
  }
  return { ok: true, input, nicheKeyword, cityToken, businessToken, distinctiveToken };
}

export type ClientDomainSuggestions = {
  ok: boolean;
  reason?: string;
  seed: ClientDomainSeed;
  candidates: ClientDomainCandidate[];
  scoreContexts: { local: DomainIQScoreContext; brand: DomainIQScoreContext; operator: DomainIQScoreContext };
  meta: {
    nicheKey: string | null;
    resolutionSource: string;
    localKeywords: string[];
    brandKeywords: string[];
  };
};

export function suggestClientDomains(
  engine: DomainIQEngine,
  rawInput: ClientDomainSeedInput,
  opts: { localCount?: number; brandCount?: number; tlds?: string[] } = {}
): ClientDomainSuggestions {
  const seed = buildClientDomainSeed(rawInput, engine);
  const emptyCtx: DomainIQScoreContext = {};
  if (!seed.ok) {
    return {
      ok: false,
      reason: seed.reason,
      seed,
      candidates: [],
      scoreContexts: { local: emptyCtx, brand: emptyCtx, operator: emptyCtx },
      meta: { nicheKey: null, resolutionSource: "none", localKeywords: [], brandKeywords: [] },
    };
  }
  const localCount = opts.localCount ?? 6;
  const brandCount = opts.brandCount ?? 6;
  const tlds = opts.tlds?.length ? opts.tlds : ["com"];
  const niche = seed.input.niche || null;

  const localKeywords = Array.from(
    new Set([seed.nicheKeyword, seed.cityToken, seed.businessToken, seed.distinctiveToken].filter((k) => k.length >= 2))
  );
  const local = engine.generate({
    keywords: localKeywords,
    niche,
    industry: niche,
    style: "descriptive",
    tlds,
    count: 100,
  });
  const localMarkers = [seed.cityToken, seed.distinctiveToken, seed.businessToken].filter((t) => t.length >= 3);
  const localPicks = local.ranked
    .filter((s) => localMarkers.some((marker) => s.label.includes(marker)))
    .slice(0, localCount);

  const brandKeywords = niche ? [] : [seed.distinctiveToken || seed.businessToken].filter(Boolean);
  const brand = engine.generate({
    keywords: brandKeywords,
    niche,
    industry: niche,
    style: "brandable",
    tlds,
    count: brandCount,
  });

  const toCandidate = (s: (typeof local.ranked)[number], source: ClientDomainCandidate["source"]): ClientDomainCandidate => ({
    domain: s.fullName,
    label: s.label,
    tld: s.tld,
    score: s.total,
    band: s.band,
    source,
    pattern: s.pattern,
    summary: s.summary,
    explanation: s.explanation,
    highlights: s.highlights,
    concerns: s.concerns,
    subScores: s.subScores,
    nicheKey: s.nicheKey,
    availability: "unchecked",
  });

  const seen = new Set<string>();
  const merged: ClientDomainCandidate[] = [];
  for (const candidate of [
    ...localPicks.map((s) => toCandidate(s, "local")),
    ...brand.top.map((s) => toCandidate(s, "brand")),
  ]) {
    if (seen.has(candidate.domain)) continue;
    seen.add(candidate.domain);
    merged.push(candidate);
  }
  merged.sort((a, b) => b.score - a.score);

  return {
    ok: merged.length > 0,
    reason: merged.length ? undefined : "DomainIQ returned no candidates that pass its filters for this seed.",
    seed,
    candidates: merged,
    scoreContexts: { local: local.scoreContext, brand: brand.scoreContext, operator: brand.scoreContext },
    meta: {
      nicheKey: brand.nicheKey,
      resolutionSource: brand.resolutionSource,
      localKeywords,
      brandKeywords: brand.engineKeywords,
    },
  };
}

export function applyAvailabilityResults(
  candidates: ClientDomainCandidate[],
  results: AvailabilityResult[]
): ClientDomainCandidate[] {
  const byDomain = new Map(results.map((r) => [r.domain.toLowerCase(), r]));
  return candidates.map((candidate) => {
    const hit = byDomain.get(candidate.domain.toLowerCase());
    if (!hit) return candidate;
    return {
      ...candidate,
      availability: hit.status,
      availabilityCheckedAt: hit.checkedAt,
      availabilityDetail: hit.detail,
    };
  });
}

/** Operator pick. Selecting is not buying: status becomes `selected` (awaiting Tony's purchase sign-off). */
export function selectCandidate(
  candidates: ClientDomainCandidate[],
  domain: string
): { ok: true; domain: string; domainStatus: "selected"; warning?: string } | { ok: false; error: string } {
  const wanted = domain.trim().toLowerCase();
  const hit = candidates.find((c) => c.domain === wanted);
  if (!hit) return { ok: false, error: `${wanted || "(empty)"} is not one of this client's domain candidates.` };
  const warning =
    hit.availability === "registered"
      ? "Already registered per RDAP/DNS - only usable if the client owns it or acquires it."
      : hit.availability === "available"
        ? undefined
        : "Availability not verified - check before purchase.";
  return { ok: true, domain: hit.domain, domainStatus: "selected", warning };
}

/**
 * DomainIQ's oversampling idea, applied after scoring: most top-scoring .com names
 * are already registered, so check a wider ranked pool and surface the verified
 * `available` names first (by score), then a few of the best taken ones for context.
 * Unchecked names (beyond the check budget or on lookup error) are never shown as available.
 */
export function rankByVerifiedAvailability(
  pool: ClientDomainCandidate[],
  results: AvailabilityResult[],
  opts: { max?: number; keepUnavailable?: number } = {}
): ClientDomainCandidate[] {
  const max = opts.max ?? 12;
  const keepUnavailable = opts.keepUnavailable ?? 4;
  const merged = applyAvailabilityResults(pool, results).sort((a, b) => b.score - a.score);
  const available = merged.filter((c) => c.availability === "available").slice(0, max);
  const rest = merged
    .filter((c) => c.availability !== "available")
    .slice(0, Math.max(keepUnavailable, max - available.length));
  return [...available, ...rest].slice(0, Math.max(max, available.length + keepUnavailable));
}
