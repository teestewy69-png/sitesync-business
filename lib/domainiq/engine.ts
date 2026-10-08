/**
 * DomainIQ generation + scoring engine, ported from DomainIQ's Python backend
 * (app/services/generation/* and app/services/scoring/*) so Sitesinc can run it
 * in-process on Netlify with no extra server, database, or API key.
 *
 * Faithful to DomainIQ's deterministic path. Parity is enforced by
 * scripts/domainiq.test.mjs against fixtures produced by the real Python engine
 * (scripts/domainiq/export-domainiq.py).
 *
 * Intentionally NOT ported (live / rotating / resale-only inputs):
 * hot-niche rotation by UTC date, live trends, sale-history harvest,
 * liquidity/flip-score blend, trademark prescreen, RDAP oversampling loop.
 * Availability is a separate optional step (./availability.ts).
 *
 * Pure module: type-only imports, data injected, so `node --test` can load it.
 */
import type {
  DomainIQData,
  DomainIQGenerateRequest,
  DomainIQGenerateResult,
  DomainIQScore,
  DomainIQScoreBand,
  DomainIQScoreContext,
  DomainIQSubScores,
  DomainIQSuggestion,
  NicheProfileData,
} from "./types";

const VOWELS = "aeiouy";
const REPEATED_CHAR = /(.)\1{2,}/;
const CONSONANT_CLUSTER = /[^aeiouy]{4,}/;
const BRANDABLE_CLUSTER = /[^aeiouy]{3,}/;
const UGLY_PREFIXES = ["xxx", "aa", "zz", "qq", "xx"];
const BLOCKLIST_SUBSTRINGS = ["www", "http", "ftp", "admin", "login"];
const BRANDABLE_MAX_LENGTH = 14;
const BRANDABLE_MIN_LENGTH = 4;
// Same as DomainIQ's ^(?!-)[a-z0-9-]{1,63}(?<!-)\.(?!-)[a-z0-9-]{1,63}(?<!-)$ (no lookbehind for ES2017 target).
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Generic fallback profile keys, as in DomainIQ resolver. */
const GENERIC_KEYS = new Set(["custom", "other", "brandable"]);

// Oversample attempt-1 parameters (app/services/generation/oversample.py).
const POOL_MULTIPLIER = 12;
const POOL_MIN = 64;
const POOL_MAX = 240;
const ATTEMPT_ONE_ROTATION = ["two_word", "keyword_trend"];

// ---------------------------------------------------------------------------
// Python-compatible helpers
// ---------------------------------------------------------------------------

export function uniq<T>(items: Iterable<T>): T[] {
  return Array.from(new Set(items));
}

/** Python str.isalpha() for cased scripts: non-empty and every character is a letter. */
function isAlpha(value: string): boolean {
  if (!value) return false;
  for (const char of value) {
    if (char.toLowerCase() === char.toUpperCase()) return false;
  }
  return true;
}

/** Python `round(x, 2)` on a float: nearest 2dp value, ties-to-even on the exact binary value. */
export function pyRound2(x: number): number {
  if (!Number.isFinite(x)) return x;
  const eighths = x * 8;
  if (Number.isInteger(eighths) && Math.abs(eighths) % 2 === 1) {
    const scaled = x * 100; // exact: 12.5 * odd integer
    const lo = Math.floor(scaled);
    const pick = lo % 2 === 0 ? lo : lo + 1;
    return pick / 100;
  }
  return Number(x.toFixed(2));
}

const toHundredths = (value: number) => Math.round(value * 100);

/** Integer division with ROUND_HALF_EVEN (Decimal default context). */
function divHalfEven(n: number, d: number): number {
  const q = Math.trunc(n / d);
  const r = n - q * d;
  const twice = Math.abs(r) * 2;
  if (twice > d) return q + Math.sign(n);
  if (twice < d) return q;
  return q % 2 === 0 ? q : q + Math.sign(n);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toScore(value: number): number {
  return pyRound2(clampScore(value));
}

export function normalizeFullName(raw: string): string {
  let value = raw.trim().toLowerCase();
  if (value.startsWith("http://")) value = value.slice("http://".length);
  if (value.startsWith("https://")) value = value.slice("https://".length);
  value = value.split("/")[0];
  if (!DOMAIN_PATTERN.test(value)) throw new Error(`Invalid domain format: ${raw}`);
  return value;
}

export function parseDomain(raw: string): { label: string; tld: string } {
  const normalized = normalizeFullName(raw);
  const index = normalized.lastIndexOf(".");
  return { label: normalized.slice(0, index), tld: normalized.slice(index + 1) };
}

export function buildFullName(name: string, tld: string): string {
  return normalizeFullName(`${name.trim().toLowerCase()}.${tld.trim().toLowerCase().replace(/^\.+/, "")}`);
}

/** Lowercase a-z only (DomainIQ normalize_label without hyphens). */
export function normalizeLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/[^a-z]/g, "");
}

// ---------------------------------------------------------------------------
// Engine factory
// ---------------------------------------------------------------------------

type Candidate = { name: string; tld: string; pattern: string };
type Pattern = [label: string, pattern: string];

type Catalog = {
  premiumRoots: string[];
  businessSuffixes: string[];
  businessPrefixes: string[];
  brandableEndings: string[];
  maxRootsForCombination: number;
  maxTrendsForCombination: number;
  maxTwoWordPool: number;
};

type GenerationOptions = {
  keywords: string[];
  tlds: string[];
  count: number;
  collectLimit: number;
  style: string;
  maxLabelLength: number;
  minLabelLength: number;
  trendWords: string[];
  excludedFullNames: Set<string>;
  nicheAvoidWords: string[];
  nicheAvoidPatterns: string[];
  nichePreferredPatterns: string[];
  nichePositiveWords: string[];
  nicheTone: string[];
};

type Resolution = {
  profile: NicheProfileData | null;
  matchedTokens: string[];
  source: "curated" | "fallback_generic" | "none";
};

type Strategy = {
  name: string;
  build: (keywords: string[], trends: string[], catalog: Catalog) => Pattern[];
  enabledForShortStyle: boolean;
  enabledForBrandable: boolean;
  brandableOnly: boolean;
};

export type DomainIQEngine = ReturnType<typeof createDomainIQEngine>;

export function createDomainIQEngine(data: DomainIQData) {
  const W = data.wordlists;
  const L = data.lexicon;
  const S = data.scoring;
  const R = S.rules;
  const DICTIONARY = new Set(L.dictionary);
  const PROFILES = data.profiles;
  const PROFILE_BY_KEY = new Map(PROFILES.map((profile) => [profile.key, profile]));
  const GENERIC = data.genericProfile;
  const PREMIUM_TLDS = new Set(S.premiumTlds);
  const SECONDARY_TLDS = new Set(S.secondaryTlds);
  const MODERN_TLDS = new Set(S.modernTlds);
  const TREND_KEYWORDS = [...S.trendKeywords].sort();
  const HIGH_RISK_TERMS = [...S.highRiskTerms];
  const COMMERCIAL_SUFFIXES = [...S.commercialSuffixes].sort();
  const LEN = S.lengths;
  const TH = {
    strong: Number(S.thresholds.strong),
    weak: Number(S.thresholds.weak),
    highRisk: Number(S.thresholds.highRisk),
    bandExcellent: Number(S.thresholds.bandExcellent),
    bandStrong: Number(S.thresholds.bandStrong),
    bandModerate: Number(S.thresholds.bandModerate),
  };
  const WEIGHT_HUNDREDTHS = Object.fromEntries(
    Object.entries(S.weights).map(([key, value]) => [key, Math.round(Number(value) * 100)])
  ) as Record<keyof DomainIQSubScores, number>;

  // ------------------------------------------------------------------ lexicon
  function nicheWords(niche: string | null | undefined, limit = 12): string[] {
    if (niche) {
      const curated = L.nicheHeads[niche.trim().toLowerCase()];
      if (curated && curated.length) return curated.slice(0, limit);
    }
    return L.headNouns.slice(0, limit);
  }

  function splitCompound(label: string): [string, string] | null {
    const cleaned = Array.from(label.trim().toLowerCase())
      .filter((char) => isAlpha(char))
      .join("");
    if (cleaned.length < 6) return null;
    const midpoint = cleaned.length / 2;
    let best: [string, string] | null = null;
    let bestImbalance = Infinity;
    for (let cut = 3; cut < cleaned.length - 2; cut += 1) {
      const left = cleaned.slice(0, cut);
      const right = cleaned.slice(cut);
      if (!DICTIONARY.has(left) || !DICTIONARY.has(right)) continue;
      const imbalance = Math.abs(cut - midpoint);
      if (imbalance < bestImbalance) {
        best = [left, right];
        bestImbalance = imbalance;
      }
    }
    return best;
  }

  function compoundPool(keywords: string[], extraWords: string[], limit: number): [string[], string[]] {
    const usable = (word: string) => {
      const cleaned = word.trim().toLowerCase();
      return isAlpha(cleaned) && cleaned.length >= 3 && cleaned.length <= 6;
    };
    const seeds = keywords.filter(usable).map((word) => word.trim().toLowerCase());
    const extras = extraWords.filter(usable).map((word) => word.trim().toLowerCase());
    const heads = nicheWords(null, 14);
    const leading = uniq([...seeds, ...extras, ...L.modifiers]).slice(0, limit);
    const trailing = uniq([...seeds, ...heads, ...extras, ...L.headNouns]).slice(0, limit);
    return [leading, trailing];
  }

  // ---------------------------------------------------------------- combiners
  const uniqueKeywords = (keywords: string[]) =>
    uniq(keywords.filter((k) => k.trim()).map((k) => k.trim().toLowerCase()));

  const shouldCombine = (left: string, right: string) =>
    Boolean(left && right && left !== right && !left.endsWith(right) && !right.startsWith(left));

  const premiumRoots = (keywords: string[], catalog: Catalog) =>
    uniq([...uniqueKeywords(keywords), ...catalog.premiumRoots]).slice(0, catalog.maxRootsForCombination);

  const keywordOnly: Strategy["build"] = (keywords) =>
    uniqueKeywords(keywords).map((keyword) => [keyword, "keyword"]);

  const keywordWithSuffixes: Strategy["build"] = (keywords, _t, catalog) => {
    const out: Pattern[] = [];
    for (const keyword of uniqueKeywords(keywords))
      for (const suffix of catalog.businessSuffixes)
        if (shouldCombine(keyword, suffix)) out.push([`${keyword}${suffix}`, "keyword_suffix"]);
    return out;
  };

  const keywordWithRoots: Strategy["build"] = (keywords, _t, catalog) => {
    const out: Pattern[] = [];
    const roots = premiumRoots(keywords, catalog);
    for (const keyword of uniqueKeywords(keywords))
      for (const root of roots) {
        if (!shouldCombine(keyword, root)) continue;
        out.push([`${keyword}${root}`, "keyword_root"]);
        out.push([`${root}${keyword}`, "root_keyword"]);
      }
    return out;
  };

  const keywordWithTrends: Strategy["build"] = (keywords, trends) => {
    const out: Pattern[] = [];
    for (const keyword of uniqueKeywords(keywords))
      for (const trend of trends) {
        if (!shouldCombine(keyword, trend)) continue;
        out.push([`${keyword}${trend}`, "keyword_trend"]);
        out.push([`${trend}${keyword}`, "trend_keyword"]);
      }
    return out;
  };

  const trendWithSuffixes: Strategy["build"] = (_k, trends, catalog) => {
    const out: Pattern[] = [];
    for (const trend of trends)
      for (const suffix of catalog.businessSuffixes)
        if (shouldCombine(trend, suffix)) out.push([`${trend}${suffix}`, "trend_suffix"]);
    return out;
  };

  const keywordWithPrefixes: Strategy["build"] = (keywords, _t, catalog) => {
    const out: Pattern[] = [];
    for (const prefix of catalog.businessPrefixes)
      for (const keyword of uniqueKeywords(keywords))
        if (shouldCombine(prefix, keyword)) out.push([`${prefix}${keyword}`, "prefix_keyword"]);
    return out;
  };

  const rootWithSuffixes: Strategy["build"] = (keywords, _t, catalog) => {
    const out: Pattern[] = [];
    for (const root of premiumRoots(keywords, catalog))
      for (const suffix of catalog.businessSuffixes)
        if (shouldCombine(root, suffix)) out.push([`${root}${suffix}`, "root_suffix"]);
    return out;
  };

  const twoWord: Strategy["build"] = (keywords, trends, catalog) => {
    const normalized = uniqueKeywords(keywords);
    const [leading, trailing] = compoundPool(
      normalized,
      trends.slice(0, catalog.maxTrendsForCombination),
      catalog.maxTwoWordPool
    );
    const out: Pattern[] = [];
    for (let i = 0; i < normalized.length; i += 1)
      for (let j = i + 1; j < normalized.length; j += 1) {
        const first = normalized[i];
        const second = normalized[j];
        if (!shouldCombine(first, second)) continue;
        out.push([`${first}${second}`, "keyword_pair"]);
        out.push([`${second}${first}`, "keyword_pair_reverse"]);
      }
    for (const first of leading)
      for (const second of trailing)
        if (shouldCombine(first, second)) out.push([`${first}${second}`, "two_word"]);
    return out;
  };

  const prefixRootSuffix: Strategy["build"] = (keywords, _t, catalog) => {
    const roots = premiumRoots(keywords, catalog).slice(0, 10);
    const out: Pattern[] = [];
    for (const prefix of catalog.businessPrefixes.slice(0, 6))
      for (const root of roots.slice(0, 8))
        for (const suffix of catalog.businessSuffixes.slice(0, 8)) {
          if (prefix === root || root === suffix || prefix === suffix) continue;
          out.push([`${prefix}${root}${suffix}`, "prefix_root_suffix"]);
        }
    return out;
  };

  function brandableStem(word: string, maxLen = 6): string {
    const cleaned = word.trim().toLowerCase();
    if (cleaned.length <= maxLen) return cleaned;
    const window = cleaned.slice(0, maxLen);
    for (let index = window.length - 1; index > 2; index -= 1) {
      if (VOWELS.includes(window[index])) return window.slice(0, index + 1);
    }
    return window;
  }

  const brandableBlends: Strategy["build"] = (keywords, trends, catalog) => {
    const stems = uniq([
      ...uniqueKeywords(keywords).map((keyword) => brandableStem(keyword)),
      ...trends
        .slice(0, 8)
        .filter((trend) => trend.length >= 3)
        .map((trend) => brandableStem(trend, 5)),
    ]).filter((stem) => stem.length >= 3);
    const endings = catalog.brandableEndings.filter(
      (ending) => ending !== "ify" && ending !== "zone" && ending.length >= 2
    );
    const out: Pattern[] = [];
    for (const stem of stems) {
      for (const ending of endings) {
        if (stem.endsWith(ending) || ending.startsWith(stem)) continue;
        if (stem[stem.length - 1] === ending[0]) continue;
        const label = `${stem}${ending}`;
        if (label.length > 10 || label.length < 4) continue;
        out.push([label, "brandable_blend"]);
      }
      for (const root of catalog.premiumRoots.slice(0, 12)) {
        if (!shouldCombine(stem, root)) continue;
        const blended = `${stem}${root}`;
        if (blended.length >= 4 && blended.length <= 10) out.push([blended, "brandable_root"]);
        if (root.length <= 5) {
          const reverse = `${root}${stem}`;
          if (reverse.length >= 4 && reverse.length <= 10) out.push([reverse, "brandable_root_reverse"]);
        }
      }
    }
    return out;
  };

  const strategy = (
    name: string,
    build: Strategy["build"],
    flags: Partial<Pick<Strategy, "enabledForShortStyle" | "enabledForBrandable" | "brandableOnly">> = {}
  ): Strategy => ({
    name,
    build,
    enabledForShortStyle: flags.enabledForShortStyle ?? true,
    enabledForBrandable: flags.enabledForBrandable ?? true,
    brandableOnly: flags.brandableOnly ?? false,
  });

  const STRATEGIES: Strategy[] = [
    strategy("two_word", twoWord),
    strategy("keyword_root", keywordWithRoots),
    strategy("keyword_suffix", keywordWithSuffixes),
    strategy("keyword_trend", keywordWithTrends),
    strategy("trend_suffix", trendWithSuffixes),
    strategy("brandable_blend", brandableBlends, { brandableOnly: true }),
    strategy("keyword", keywordOnly),
    strategy("root_suffix", rootWithSuffixes),
    strategy("prefix_keyword", keywordWithPrefixes, { enabledForBrandable: false }),
    strategy("prefix_root_suffix", prefixRootSuffix, { enabledForShortStyle: false, enabledForBrandable: false }),
  ];

  function buildLabelPatterns(
    keywords: string[],
    opts: {
      style: string;
      maxLabelLength: number;
      minLabelLength: number;
      trendWords: string[];
      preferredPatterns: string[];
    }
  ): Pattern[] {
    const brandable = opts.style === "brandable";
    const catalog: Catalog = {
      premiumRoots: W.premiumRoots,
      businessSuffixes: [...W.shortBusinessSuffixes, ...(brandable ? [] : W.longBusinessSuffixes)],
      businessPrefixes: W.businessPrefixes,
      brandableEndings: W.brandableEndings,
      maxRootsForCombination: W.maxRootsForCombination,
      maxTrendsForCombination: W.maxTrendsForCombination,
      maxTwoWordPool: W.maxTwoWordPool,
    };
    const normalizedKeywords = new Set(keywords.filter((k) => k && k.trim()).map((k) => k.trim().toLowerCase()));
    const ordered = uniq(opts.trendWords.filter((w) => w && w.trim()).map((w) => w.toLowerCase()));
    const resolvedTrends = [
      ...ordered.filter((w) => !normalizedKeywords.has(w)),
      ...ordered.filter((w) => normalizedKeywords.has(w)),
    ].slice(0, catalog.maxTrendsForCombination);

    let strategies = [...STRATEGIES];
    const preferred = opts.preferredPatterns;
    if (preferred.length) {
      const set = new Set(preferred);
      strategies = [...strategies.filter((s) => set.has(s.name)), ...strategies.filter((s) => !set.has(s.name))];
    }
    if (brandable) {
      const allow = new Set([
        "two_word",
        "keyword_root",
        "keyword_suffix",
        "keyword_trend",
        "root_suffix",
        "brandable_blend",
        ...preferred,
      ]);
      strategies = strategies.filter((s) => allow.has(s.name) || s.brandableOnly);
      const lead = preferred.length ? preferred[0] : "two_word";
      if (lead === "two_word") {
        strategies = [
          ...strategies.filter((s) => s.name === "two_word"),
          ...strategies.filter((s) => s.name !== "two_word"),
        ];
      }
    }

    const patterns: Pattern[] = [];
    for (const item of strategies) {
      if (opts.style === "short" && !item.enabledForShortStyle) continue;
      if (brandable && !item.enabledForBrandable) continue;
      if (item.brandableOnly && !brandable) continue;
      patterns.push(...item.build(keywords, resolvedTrends, catalog));
    }

    const seen = new Set<string>();
    const unique: Pattern[] = [];
    for (const [label, pattern] of patterns) {
      const key = label.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push([label, pattern]);
    }
    return unique.filter(
      ([label]) => label.length >= opts.minLabelLength && label.length <= opts.maxLabelLength
    );
  }

  // ------------------------------------------------------------------ filters
  function hasRepeatedToken(label: string, minTokenLength = 3): boolean {
    if (label.length < minTokenLength * 2) return false;
    for (let size = minTokenLength; size <= Math.floor(label.length / 2); size += 1) {
      if (label.slice(size, size * 2) === label.slice(0, size)) return true;
    }
    return false;
  }

  const vowelRatio = (label: string) =>
    label ? Array.from(label.toLowerCase()).filter((c) => VOWELS.includes(c)).length / label.length : 0;
  const hasVowel = (label: string) => Array.from(label).some((c) => VOWELS.includes(c));

  function isValidLabel(label: string, options: GenerationOptions): boolean {
    if (!label) return false;
    if (label.length < options.minLabelLength || label.length > options.maxLabelLength) return false;
    if (!/^[a-z]+$/.test(label)) return false;
    if (REPEATED_CHAR.test(label)) return false;
    if (CONSONANT_CLUSTER.test(label)) return false;
    if (hasRepeatedToken(label)) return false;
    if (BLOCKLIST_SUBSTRINGS.some((token) => label.includes(token))) return false;
    if (label.length > 6 && !hasVowel(label)) return false;
    return true;
  }

  function isPronounceableBrandable(label: string): boolean {
    if (label.length < BRANDABLE_MIN_LENGTH || label.length > BRANDABLE_MAX_LENGTH) return false;
    if (!isAlpha(label)) return false;
    if (!hasVowel(label)) return false;
    if (vowelRatio(label) < 0.25) return false;
    if (BRANDABLE_CLUSTER.test(label) && splitCompound(label) === null) return false;
    if (REPEATED_CHAR.test(label)) return false;
    if (hasRepeatedToken(label)) return false;
    if (UGLY_PREFIXES.some((prefix) => label.startsWith(prefix))) return false;
    if (label.endsWith("ing") && label.length > 8) return false;
    return true;
  }

  function passesGenerationFilters(label: string, options: GenerationOptions): boolean {
    if (!isValidLabel(label, options)) return false;
    if (options.style === "short" && label.length > 8) return false;
    if (options.style === "brandable" && !isPronounceableBrandable(label)) return false;
    const lowered = label.toLowerCase();
    if (options.nicheAvoidWords.some((word) => word && lowered.includes(word))) return false;
    if (options.nicheAvoidPatterns.some((pattern) => pattern && lowered.includes(pattern))) return false;
    return true;
  }

  function generateCandidates(options: GenerationOptions): { candidates: Candidate[]; rejected: number } {
    const patterns = buildLabelPatterns(options.keywords, {
      style: options.style,
      maxLabelLength: options.maxLabelLength,
      minLabelLength: options.minLabelLength,
      trendWords: options.trendWords,
      preferredPatterns: options.nichePreferredPatterns,
    });
    const candidates: Candidate[] = [];
    const seenFull = new Set<string>();
    const seenLabels = new Set<string>();
    let rejected = 0;
    const primary = options.tlds[0] || "com";
    const tldOrder = [primary, ...options.tlds.slice(1).filter((tld) => tld !== primary)];
    for (const [raw, pattern] of patterns) {
      const label = normalizeLabel(raw);
      if (!label || seenLabels.has(label) || !passesGenerationFilters(label, options)) {
        rejected += 1;
        continue;
      }
      seenLabels.add(label);
      let placed = false;
      for (const tld of tldOrder) {
        const full = buildFullName(label, tld);
        if (seenFull.has(full) || options.excludedFullNames.has(full)) continue;
        seenFull.add(full);
        candidates.push({ name: label, tld, pattern });
        placed = true;
        break;
      }
      if (!placed) {
        rejected += 1;
        continue;
      }
      if (candidates.length >= options.collectLimit) break;
    }
    return { candidates, rejected };
  }

  // -------------------------------------------------------- niche resolution
  const matchesAlias = (profile: NicheProfileData, token: string) => {
    const cleaned = token.trim().toLowerCase();
    return cleaned === profile.key || profile.aliases.includes(cleaned);
  };

  function tokenize(keywords: string[], industry: string | null | undefined): string[] {
    const tokens: string[] = [];
    const split = (value: string) => value.split(/\s+/).filter(Boolean);
    for (const item of keywords) {
      const cleaned = item.trim().toLowerCase().replace(/_/g, " ").replace(/-/g, " ");
      if (!cleaned) continue;
      tokens.push(cleaned);
      tokens.push(...split(cleaned));
    }
    if (industry) {
      const cleaned = industry.trim().toLowerCase();
      tokens.push(cleaned);
      tokens.push(...split(cleaned.replace(/-/g, " ")));
    }
    return uniq(tokens);
  }

  function resolveNiche(
    keywords: string[],
    industry: string | null | undefined,
    opts: { nicheKey?: string | null; fallbackGeneric?: boolean; matchPositiveWords?: boolean } = {}
  ): Resolution {
    const fallbackGeneric = opts.fallbackGeneric ?? true;
    const matchPositive = opts.matchPositiveWords ?? true;
    const explicit = (opts.nicheKey || "").trim().toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
    if (GENERIC_KEYS.has(explicit)) {
      return { profile: GENERIC, matchedTokens: [explicit], source: "fallback_generic" };
    }
    if (explicit) {
      const direct = PROFILE_BY_KEY.get(explicit);
      if (direct) return { profile: direct, matchedTokens: [explicit], source: "curated" };
      for (const candidate of PROFILES) {
        if (matchesAlias(candidate, explicit.replace(/_/g, " ")) || matchesAlias(candidate, explicit)) {
          return { profile: candidate, matchedTokens: [explicit], source: "curated" };
        }
      }
    }
    const tokens = tokenize(keywords, industry);
    if (!tokens.length) {
      return fallbackGeneric
        ? { profile: GENERIC, matchedTokens: [], source: "fallback_generic" }
        : { profile: null, matchedTokens: [], source: "none" };
    }
    for (const token of tokens) {
      const profile = PROFILE_BY_KEY.get(token) || PROFILE_BY_KEY.get(token.replace(/ /g, "_"));
      if (profile) return { profile, matchedTokens: [token], source: "curated" };
      for (const candidate of PROFILES) {
        if (matchesAlias(candidate, token)) return { profile: candidate, matchedTokens: [token], source: "curated" };
      }
    }
    for (const candidate of PROFILES) {
      const matched: string[] = [];
      for (const token of tokens) {
        const compact = token.replace(/ /g, "");
        if (
          compact.includes(candidate.key.replace(/_/g, "")) ||
          candidate.aliases.some((alias) => compact.includes(alias.replace(/-/g, "").replace(/ /g, "")))
        ) {
          matched.push(token);
          continue;
        }
        if (matchPositive && candidate.positive_words.slice(0, 8).some((word) => token.includes(word))) {
          matched.push(token);
        }
      }
      if (matched.length) return { profile: candidate, matchedTokens: uniq(matched), source: "curated" };
    }
    return fallbackGeneric
      ? { profile: GENERIC, matchedTokens: tokens.slice(0, 3), source: "fallback_generic" }
      : { profile: null, matchedTokens: tokens.slice(0, 3), source: "none" };
  }

  function generationSeeds(profile: NicheProfileData, limit = 8): string[] {
    const seeds = profile.seed_keywords.length
      ? [...profile.seed_keywords]
      : [profile.key, ...profile.positive_words.slice(0, 6)];
    return uniq(seeds.filter(Boolean)).slice(0, limit);
  }

  function phoneticStems(keywords: string[]): string[] {
    const stems: string[] = [];
    for (const keyword of keywords) {
      const cleaned = keyword.trim().toLowerCase();
      if (cleaned.length < 3) continue;
      for (const fragment of data.phoneticFragments) {
        if (cleaned.includes(fragment) || cleaned.endsWith(fragment)) continue;
        if (fragment.length >= 2 && fragment.length <= 3) stems.push(fragment);
      }
    }
    return uniq(stems);
  }

  /** harvest_niche_words with hot-niche rotation excluded (deterministic). */
  function harvestNicheWords(keywords: string[], industry: string | null, resolution: Resolution) {
    const profile = resolution.profile;
    const niche = profile ? profile.key : null;
    const pool: string[] = [];
    for (const keyword of keywords) {
      const cleaned = keyword.trim().toLowerCase().replace(/ /g, "");
      if (isAlpha(cleaned) && cleaned.length >= 3) pool.push(cleaned);
    }
    if (profile) {
      const seedSet = new Set(
        keywords.filter((k) => k && k.trim()).map((k) => k.trim().toLowerCase().replace(/ /g, ""))
      );
      pool.push(...profile.positive_words.filter((w) => !seedSet.has(w)));
      pool.push(...profile.positive_words.filter((w) => seedSet.has(w)));
    }
    if (industry) {
      pool.push(...(W.industryTrendWords[industry.trim().toLowerCase()] || []));
      if (niche) pool.push(...(W.industryTrendWords[niche] || []));
    }
    pool.push(...phoneticStems(keywords).filter((stem) => stem.length >= 3 && stem.length <= 5));
    const avoid = new Set([...(profile?.avoid_words || []), ...(profile?.avoid_patterns || [])]);
    const longAvoid = [...avoid].filter((bad) => bad.length >= 4);
    const words = uniq(pool.filter((w) => w && isAlpha(w)))
      .filter((w) => !avoid.has(w) && !longAvoid.some((bad) => w.includes(bad)))
      .slice(0, 24);
    return { niche, words };
  }

  // ------------------------------------------------------------------ scoring
  const estimateSyllables = (label: string) => {
    let count = 0;
    let previous = false;
    for (const char of label.toLowerCase()) {
      const vowel = VOWELS.includes(char);
      if (vowel && !previous) count += 1;
      previous = vowel;
    }
    return Math.max(count, 1);
  };
  const isCleanAlpha = (label: string) => Boolean(label) && isAlpha(label);
  const isShortLabel = (label: string) => label.length <= LEN.shortMax;
  const shortLabelCredit = (label: string) => {
    const length = label.length;
    if (length <= LEN.shortMax) return 1.0;
    if (length > LEN.compactMax) return 0.0;
    const span = LEN.compactMax + 1 - LEN.shortMax;
    return (LEN.compactMax + 1 - length) / span;
  };
  const isIdealLength = (label: string) => label.length >= LEN.idealMin && label.length <= LEN.idealMax;
  const hasConsonantCluster = (label: string) => CONSONANT_CLUSTER.test(label.toLowerCase());
  const hasLowQualityPattern = (label: string) => {
    const lowered = label.toLowerCase();
    if (REPEATED_CHAR.test(lowered)) return true;
    if (lowered.length > 6 && !hasVowel(lowered)) return true;
    return CONSONANT_CLUSTER.test(lowered);
  };
  const keywordMatchStrength = (keyword: string | null | undefined, label: string) => {
    if (!keyword) return 0.0;
    const k = keyword.trim().toLowerCase();
    const l = label.toLowerCase();
    if (!k) return 0.0;
    if (l === k) return 1.0;
    if (l.startsWith(k) || l.endsWith(k)) return 0.85;
    if (l.includes(k)) return 0.65;
    return 0.0;
  };
  const matchedTrendKeywords = (label: string) => TREND_KEYWORDS.filter((t) => label.toLowerCase().includes(t));
  const relevantTrendKeywords = (label: string, nicheTerms: readonly string[]) => {
    const matched = matchedTrendKeywords(label);
    if (!nicheTerms.length) return matched;
    const vocab = new Set(nicheTerms.filter((t) => t.trim()).map((t) => t.trim().toLowerCase()));
    return matched.filter((t) => vocab.has(t));
  };
  const levenshtein = (left: string, right: string) => {
    if (left === right) return 0;
    if (!left) return right.length;
    if (!right) return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    for (let i = 1; i <= left.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= right.length; j += 1) {
        current.push(
          Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] !== right[j - 1] ? 1 : 0))
        );
      }
      previous = current;
    }
    return previous[previous.length - 1];
  };
  const matchedRiskTerms = (label: string) => {
    const lowered = label.toLowerCase();
    const matches = new Set(HIGH_RISK_TERMS.filter((term) => lowered.includes(term)));
    for (const term of HIGH_RISK_TERMS) {
      if (matches.has(term) || term.length < 5) continue;
      if (levenshtein(lowered, term) <= 1) {
        matches.add(term);
        continue;
      }
      if (lowered.startsWith(term.slice(0, 4)) && levenshtein(lowered.slice(0, term.length), term) <= 1) {
        matches.add(term);
      }
    }
    return [...matches].sort();
  };
  const matchedCommercialSuffixes = (label: string) =>
    COMMERCIAL_SUFFIXES.filter((suffix) => label.toLowerCase().endsWith(suffix));
  const hasDirt = (label: string) => label.includes("-") || /\d/.test(label);
  const keywordBonus = (strength: number, full: number, partial: number) =>
    strength >= 1.0 ? full : strength >= 0.65 ? partial : 0.0;
  const industryInLabel = (industry: string | null | undefined, label: string) =>
    Boolean(industry) && label.toLowerCase().includes(String(industry).replace(/ /g, "").toLowerCase());

  type ScoringInput = {
    label: string;
    tld: string;
    primaryKeyword: string | null;
    industry: string | null;
    nicheKey: string | null;
    nichePositiveWords: readonly string[];
    nicheAvoidWords: readonly string[];
    nicheTone: readonly string[];
  };

  function scoreBrandability(d: ScoringInput): number {
    const label = d.label;
    const length = label.length;
    let score = R.brandability_base;
    if (isCleanAlpha(label)) score += R.brandability_alpha_bonus;
    if (hasDirt(label)) score -= R.brandability_dirty_penalty;
    const syllables = estimateSyllables(label);
    if (syllables >= 2 && syllables <= 3) score += R.brandability_ideal_syllable_bonus;
    else if (syllables === 1 && length <= 5) score += R.brandability_short_syllable_bonus;
    else if (syllables > 4) score -= R.brandability_long_syllable_penalty;
    if (isIdealLength(label)) score += R.brandability_ideal_length_bonus;
    else if (isShortLabel(label)) score += R.brandability_short_length_bonus;
    else if (length >= LEN.longMin) score -= R.brandability_long_length_penalty;
    const ratio = vowelRatio(label);
    if (ratio >= 0.28 && ratio <= 0.55) score += R.brandability_vowel_balance_bonus;
    else if (ratio < 0.15) score -= R.brandability_low_vowel_penalty;
    if (hasConsonantCluster(label)) score -= R.brandability_cluster_penalty;
    if (REPEATED_CHAR.test(label)) score -= R.brandability_repeat_penalty;
    if (S.brandableEndings.some((ending) => label.endsWith(ending))) score += R.brandability_brandable_end_bonus;
    if (isCleanAlpha(label)) score += R.brandability_clean_short_bonus * shortLabelCredit(label);
    return toScore(score);
  }

  function scoreCommercialValue(d: ScoringInput): number {
    const label = d.label;
    let score = R.commercial_base;
    if (d.tld === "com") score += R.commercial_com_bonus;
    else if (PREMIUM_TLDS.has(d.tld)) score += R.commercial_premium_tld_bonus;
    else if (SECONDARY_TLDS.has(d.tld)) score += R.commercial_secondary_tld_bonus;
    else score -= R.commercial_obscure_tld_penalty;
    const suffixes = matchedCommercialSuffixes(label);
    score += Math.min(suffixes.length * R.commercial_suffix_bonus_each, R.commercial_suffix_bonus_cap);
    if (label.length <= 11) score += R.commercial_compact_bonus;
    score += keywordBonus(
      keywordMatchStrength(d.primaryKeyword, label),
      R.commercial_keyword_full_bonus,
      R.commercial_keyword_partial_bonus
    );
    if (industryInLabel(d.industry, label)) score += R.commercial_industry_bonus;
    if (suffixes.length && isCleanAlpha(label)) score += 4.0;
    return toScore(score);
  }

  function scoreMarketDemand(d: ScoringInput): number {
    const label = d.label;
    let score = R.market_base;
    const trends = relevantTrendKeywords(label, d.nichePositiveWords);
    score += Math.min(trends.length * R.market_trend_bonus_each, R.market_trend_bonus_cap);
    score += keywordBonus(
      keywordMatchStrength(d.primaryKeyword, label),
      R.market_keyword_full_bonus,
      R.market_keyword_partial_bonus
    );
    if (industryInLabel(d.industry, label)) score += R.market_industry_bonus;
    if (MODERN_TLDS.has(d.tld)) score += R.market_modern_tld_bonus;
    const compactness = shortLabelCredit(label);
    score += R.market_short_bonus * compactness;
    if (d.tld === "com" && isCleanAlpha(label)) score += R.market_brandable_com_bonus * compactness;
    // Live-trend bonus omitted: Sitesinc never passes live trend matches.
    return toScore(score);
  }

  function scoreDomainQuality(d: ScoringInput): number {
    const label = d.label;
    let score = R.quality_base;
    if (isIdealLength(label)) score += R.quality_ideal_length_bonus;
    else if (label.length >= LEN.longMin) score -= R.quality_long_penalty;
    if (isCleanAlpha(label)) score += R.quality_alpha_bonus;
    if (label.includes("-")) score -= R.quality_hyphen_penalty;
    if (/\d/.test(label)) score -= R.quality_number_penalty;
    if (estimateSyllables(label) <= 3) score += R.quality_syllable_bonus;
    if (hasConsonantCluster(label)) score -= R.quality_cluster_penalty;
    if (isCleanAlpha(label)) score += R.quality_clean_short_bonus * shortLabelCredit(label);
    return toScore(score);
  }

  function scoreFlipPotential(d: ScoringInput): number {
    const label = d.label;
    let score = R.flip_base;
    if (d.tld === "com") {
      score += R.flip_com_bonus;
      score += R.flip_com_short_bonus * shortLabelCredit(label);
    } else if (PREMIUM_TLDS.has(d.tld)) {
      score += R.flip_premium_tld_bonus;
    }
    if (label.length <= LEN.compactMax && isCleanAlpha(label)) score += R.flip_compact_alpha_bonus;
    if (relevantTrendKeywords(label, d.nichePositiveWords).length) score += R.flip_trend_bonus;
    if (matchedCommercialSuffixes(label).length) score += R.flip_suffix_bonus;
    if (hasDirt(label)) score -= R.flip_dirty_penalty;
    return toScore(score);
  }

  function scoreRiskPenalty(d: ScoringInput): number {
    const label = d.label;
    let penalty = 0.0;
    penalty += Math.min(matchedRiskTerms(label).length * R.risk_term_penalty_each, R.risk_term_penalty_cap);
    if (/\d/.test(label)) penalty += R.risk_number_penalty;
    if (label.includes("-")) penalty += R.risk_hyphen_penalty;
    if (label.length >= LEN.extremeMin) penalty += R.risk_extreme_length_penalty;
    else if (label.length >= LEN.longMin) penalty += R.risk_long_length_penalty;
    if (!PREMIUM_TLDS.has(d.tld) && !SECONDARY_TLDS.has(d.tld)) penalty += R.risk_obscure_tld_penalty;
    if (REPEATED_CHAR.test(label)) penalty += R.risk_repeat_penalty;
    if (hasConsonantCluster(label)) penalty += R.risk_cluster_penalty;
    if (hasLowQualityPattern(label)) penalty += R.risk_low_quality_pattern_penalty;
    return toScore(penalty);
  }

  function resolveProfileForScoring(d: ScoringInput): NicheProfileData | null {
    if (d.nicheKey) {
      if (d.nicheKey === GENERIC.key || GENERIC_KEYS.has(d.nicheKey)) return GENERIC;
      return PROFILE_BY_KEY.get(d.nicheKey) || null;
    }
    const keywords = d.primaryKeyword ? [d.primaryKeyword] : [];
    return resolveNiche(keywords, d.industry, { fallbackGeneric: false, matchPositiveWords: false }).profile;
  }

  function scoreNicheFit(d: ScoringInput) {
    let profile = resolveProfileForScoring(d);
    if (!profile && d.nichePositiveWords.length) {
      profile = {
        key: d.nicheKey || "custom",
        display_name: d.nicheKey || "custom",
        aliases: [],
        positive_words: [...d.nichePositiveWords],
        avoid_words: [...d.nicheAvoidWords],
        avoid_patterns: [],
        tone: [...d.nicheTone],
        buyer_archetypes: [],
        prefer_short: true,
        max_label_length: 14,
        min_label_length: 6,
        preferred_patterns: [],
        notes: "",
        seed_keywords: [],
        selector_visible: false,
      };
    }
    if (!profile) return { score: 50, nicheKey: null as string | null, positiveHits: [] as string[], avoidHits: [] as string[] };
    const label = d.label.toLowerCase();
    const positiveHits = profile.positive_words.filter((word) => word && label.includes(word));
    const avoidHits = [
      ...profile.avoid_words.filter((word) => word && label.includes(word)),
      ...profile.avoid_patterns.filter((pattern) => pattern && label.includes(pattern)),
    ];
    let score = R.niche_fit_base;
    if (positiveHits.length) {
      score += Math.min(positiveHits.length * R.niche_fit_positive_bonus_each, R.niche_fit_positive_bonus_cap);
    } else {
      score -= R.niche_fit_no_positive_penalty;
    }
    if (avoidHits.length) {
      score -= Math.min(avoidHits.length * R.niche_fit_avoid_penalty_each, R.niche_fit_avoid_penalty_cap);
    }
    if (profile.prefer_short && label.length <= profile.max_label_length && isAlpha(label)) {
      score += R.niche_fit_short_clean_bonus;
    } else if (label.length > profile.max_label_length + 2) {
      score -= R.niche_fit_overlong_penalty;
    }
    if (profile.tone.some((t) => t === "premium" || t === "trustworthy" || t === "health-focused")) {
      if (["ly", "a", "o", "io", "um", "is"].some((sfx) => label.endsWith(sfx))) score += R.niche_fit_tone_ending_bonus;
      if (["free", "cheap", "xxx", "spam"].some((spam) => label.includes(spam))) score -= R.niche_fit_tone_clash_penalty;
    }
    return { score: pyRound2(clampScore(score)), nicheKey: profile.key, positiveHits, avoidHits };
  }

  const scoreBand = (total: number): DomainIQScoreBand =>
    total >= TH.bandExcellent ? "excellent" : total >= TH.bandStrong ? "strong" : total >= TH.bandModerate ? "moderate" : "weak";

  const positiveDims = (s: DomainIQSubScores): Array<[string, number]> => [
    ["brandability", s.brandability],
    ["commercial value", s.commercial_value],
    ["market demand", s.market_demand],
    ["domain quality", s.domain_quality],
    ["flip potential", s.flip_potential],
  ];
  const topStrengths = (s: DomainIQSubScores) =>
    [...positiveDims(s)]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .filter(([, score]) => score >= TH.strong)
      .map(([name]) => name);
  const weakestDimension = (s: DomainIQSubScores) => {
    let best = positiveDims(s)[0];
    for (const item of positiveDims(s)) if (item[1] < best[1]) best = item;
    return best[1] <= TH.weak ? best[0] : null;
  };

  function score(fullName: string, ctx: DomainIQScoreContext = {}): DomainIQScore {
    const { label, tld } = parseDomain(fullName);
    const d: ScoringInput = {
      label,
      tld,
      primaryKeyword: ctx.primaryKeyword ?? null,
      industry: ctx.industry ?? null,
      nicheKey: ctx.nicheKey ?? null,
      nichePositiveWords: ctx.nichePositiveWords ?? [],
      nicheAvoidWords: ctx.nicheAvoidWords ?? [],
      nicheTone: ctx.nicheTone ?? [],
    };
    const fit = scoreNicheFit(d);
    let market = scoreMarketDemand(d);
    if (fit.nicheKey !== null) {
      const blend = R.niche_fit_market_blend;
      market = pyRound2(Math.max(0, Math.min(100, market * (1.0 - blend) + fit.score * blend)));
    }
    const riskAddon = fit.avoidHits.length
      ? pyRound2(Math.min(fit.avoidHits.length * R.niche_risk_avoid_each, R.niche_risk_avoid_cap))
      : 0;
    const riskSum = (toHundredths(scoreRiskPenalty(d)) + toHundredths(riskAddon)) / 100;
    const risk = pyRound2(Math.min(100.0, riskSum));

    const subScores: DomainIQSubScores = {
      brandability: scoreBrandability(d),
      commercial_value: scoreCommercialValue(d),
      market_demand: market,
      domain_quality: scoreDomainQuality(d),
      flip_potential: scoreFlipPotential(d),
      risk_penalty: risk,
    };
    const contribHundredths = {} as Record<keyof DomainIQSubScores, number>;
    for (const key of Object.keys(subScores) as Array<keyof DomainIQSubScores>) {
      const product = toHundredths(subScores[key]) * WEIGHT_HUNDREDTHS[key];
      // `|| 0` normalizes -0 (Python's -Decimal("0.0") is a positive zero).
      contribHundredths[key] = divHalfEven(key === "risk_penalty" ? -product : product, 100) || 0;
    }
    const sum = Object.values(contribHundredths).reduce((acc, value) => acc + value, 0);
    const totalHundredths = Math.max(0, Math.min(10000, sum));
    const total = totalHundredths / 100;
    const contributions = Object.fromEntries(
      Object.entries(contribHundredths).map(([key, value]) => [key, value / 100])
    ) as DomainIQSubScores;

    const highlights: string[] = [];
    if (tld === "com") highlights.push("premium .com TLD");
    else if (PREMIUM_TLDS.has(tld)) highlights.push("strong TLD choice");
    if (isCleanAlpha(label) && isShortLabel(label)) highlights.push("short clean label");
    if (matchedTrendKeywords(label).length) highlights.push("contains trending keyword");
    if (matchedCommercialSuffixes(label).length) highlights.push("commercial suffix pattern");
    const strength = keywordMatchStrength(d.primaryKeyword, label);
    if (strength >= 0.85) highlights.push("strong keyword relevance");
    else if (strength >= 0.65) highlights.push("matches primary keyword");
    if (subScores.brandability >= TH.strong) highlights.push("strong brandability");
    if (subScores.flip_potential >= TH.strong) highlights.push("solid flip potential");

    const concerns: string[] = [];
    if (matchedRiskTerms(label).length) concerns.push("possible confusion with a major brand");
    if (label.includes("-")) concerns.push("contains hyphen");
    if (/\d/.test(label)) concerns.push("contains numbers");
    if (label.length >= LEN.longMin) concerns.push("long label reduces memorability");
    if (hasLowQualityPattern(label)) concerns.push("low-quality character pattern");
    if (subScores.risk_penalty >= TH.highRisk) concerns.push("elevated risk penalty");

    if (fit.positiveHits.length) highlights.push(`niche fit: ${fit.positiveHits.slice(0, 3).join(", ")}`);
    if (fit.avoidHits.length) concerns.push(`off-niche wording: ${fit.avoidHits.slice(0, 3).join(", ")}`);

    const band = scoreBand(total);
    const strengths = topStrengths(subScores);
    let summary: string;
    if ((band === "excellent" || band === "strong") && strengths.length) {
      summary = `Strong premium candidate led by ${strengths[0]}.`;
    } else if (band === "excellent" || band === "strong") {
      summary = "Strong premium candidate with balanced sub-scores.";
    } else if (concerns.length) {
      summary = `Limited by ${concerns[0]}.`;
    } else {
      const weakest = weakestDimension(subScores);
      summary = weakest
        ? `Moderate candidate with weaker ${weakest}.`
        : "Balanced domain score without a clear premium signal.";
    }

    const parts = [`Total score ${total.toFixed(2)} out of 100 (${band}).`];
    if (band === "excellent" || band === "strong") {
      parts.push(
        strengths.length
          ? `Strengths in ${strengths.join(" and ")} drive a high-quality result.`
          : "Overall quality is strong across core dimensions."
      );
    } else {
      const weakest = weakestDimension(subScores);
      parts.push(
        weakest
          ? `The weakest dimension is ${weakest}, which limits the overall score.`
          : "Scores are balanced across core dimensions without a clear standout."
      );
    }
    if (highlights.length) parts.push(`Highlights: ${highlights.slice(0, 3).join(", ")}.`);
    if (subScores.risk_penalty >= TH.highRisk) parts.push("Elevated risk factors reduce the final score.");
    else if (subScores.risk_penalty >= 15) parts.push("Moderate risk factors apply a small penalty.");
    if (concerns.length) parts.push(`Concerns: ${concerns.slice(0, 2).join(", ")}.`);

    return {
      fullName: `${label}.${tld}`,
      total,
      band,
      subScores,
      contributions,
      summary,
      explanation: parts.join(" "),
      highlights,
      concerns,
      nicheFit: fit.nicheKey ? fit.score : null,
      nicheKey: fit.nicheKey,
    };
  }

  // ----------------------------------------------------------------- pipeline
  /**
   * DomainIQ POST /generate (GenerationService.generate, discovery attempt 1)
   * without live/rotating inputs and without RDAP filtering.
   */
  function generate(request: DomainIQGenerateRequest): DomainIQGenerateResult {
    const keywords = (request.keywords || [])
      .filter((k) => k && k.trim())
      .map((k) => k.trim().toLowerCase())
      .slice(0, 10);
    const nicheRaw = request.niche == null ? null : request.niche.trim().toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
    const niche = nicheRaw || null;
    const industry = request.industry ? request.industry.slice(0, 120) : null;
    if (!keywords.length && !niche && !industry) {
      throw new Error("Select a niche or provide at least one keyword");
    }
    const tlds = uniq(
      (request.tlds || ["com"]).filter((t) => t.trim()).map((t) => t.trim().toLowerCase().replace(/^\.+/, ""))
    );
    if (!tlds.length) tlds.push("com");
    const count = Math.max(1, Math.min(100, Math.floor(request.count ?? 10)));

    const resolution = resolveNiche(keywords, industry || niche, { nicheKey: niche });
    const profile = resolution.profile;
    const userKeywords = uniq(keywords);
    const seeds = profile ? generationSeeds(profile, 8) : [];
    const seedSet = new Set(seeds);
    const extras = profile ? profile.positive_words.filter((w) => w && !seedSet.has(w)).slice(0, 8) : [];
    let engineKeywords: string[];
    if (userKeywords.length) {
      engineKeywords = uniq([...userKeywords, ...seeds, ...extras]).slice(0, 16);
    } else {
      engineKeywords = uniq([...seeds, ...extras]).slice(0, 16);
      if (!engineKeywords.length) engineKeywords = [niche || "brand"];
    }
    const trendIndustry = niche || industry;
    const harvest = harvestNicheWords(engineKeywords, trendIndustry, resolution);

    const style = request.style || "brandable";
    let maxLabelLength = 15;
    let minLabelLength = 3;
    if (style === "brandable") {
      const pmax = profile ? profile.max_label_length : 14;
      const pmin = profile ? profile.min_label_length : 6;
      maxLabelLength = Math.max(12, Math.min(14, pmax));
      minLabelLength = Math.min(6, Math.max(5, pmin));
    }
    const preferred = ["two_word", ...(profile ? profile.preferred_patterns.filter((p) => p !== "two_word") : [])];
    const batch = Math.min(Math.max(count * POOL_MULTIPLIER, POOL_MIN), POOL_MAX);

    const options: GenerationOptions = {
      keywords: engineKeywords,
      tlds,
      count: batch,
      collectLimit: batch,
      style,
      maxLabelLength,
      minLabelLength,
      trendWords: harvest.words,
      excludedFullNames: new Set(),
      nicheAvoidWords: profile ? profile.avoid_words : [],
      nicheAvoidPatterns: profile ? profile.avoid_patterns : [],
      nichePreferredPatterns: uniq([...ATTEMPT_ONE_ROTATION, ...preferred]),
      nichePositiveWords: profile ? profile.positive_words : [],
      nicheTone: profile ? profile.tone : [],
    };
    const result = generateCandidates(options);
    const primaryKeyword = userKeywords[0] || engineKeywords[0];
    const nicheKey = harvest.niche;
    const terms =
      nicheKey || options.nichePositiveWords.length
        ? uniq([...options.nichePositiveWords, ...nicheWords(nicheKey)]).sort()
        : [];
    const ctx: DomainIQScoreContext = {
      primaryKeyword,
      industry: nicheKey,
      nicheKey,
      nichePositiveWords: terms,
      nicheAvoidWords: options.nicheAvoidWords,
      nicheTone: options.nicheTone,
    };
    const ranked: DomainIQSuggestion[] = result.candidates.map((candidate) => ({
      ...score(buildFullName(candidate.name, candidate.tld), ctx),
      pattern: candidate.pattern,
      label: candidate.name,
      tld: candidate.tld,
    }));
    ranked.sort((a, b) => b.total - a.total);
    return {
      scoreContext: ctx,
      nicheKey,
      resolutionSource: resolution.source,
      engineKeywords,
      harvestWords: harvest.words,
      primaryKeyword,
      style,
      generatedLabels: result.candidates.map((c) => `${c.name}.${c.tld}:${c.pattern}`),
      rejectedCount: result.rejected,
      top: ranked.slice(0, count),
      ranked,
    };
  }

  function profileFor(nicheKey: string | null | undefined): NicheProfileData | null {
    if (!nicheKey) return null;
    if (GENERIC_KEYS.has(nicheKey) || nicheKey === GENERIC.key) return GENERIC;
    return PROFILE_BY_KEY.get(nicheKey) || null;
  }

  /** Scoring context DomainIQ would attach to a generated name for this niche (generation metadata). */
  function scoreContextForNiche(nicheOrIndustry: string, primaryKeyword?: string | null): DomainIQScoreContext {
    const resolution = resolveNiche(primaryKeyword ? [primaryKeyword] : [], nicheOrIndustry, {
      nicheKey: nicheOrIndustry,
    });
    const profile = resolution.profile;
    const nicheKey = profile ? profile.key : null;
    const positives = profile ? profile.positive_words : [];
    return {
      primaryKeyword: primaryKeyword || (profile ? generationSeeds(profile, 8)[0] : null),
      industry: nicheKey,
      nicheKey,
      nichePositiveWords: nicheKey || positives.length ? uniq([...positives, ...nicheWords(nicheKey)]).sort() : [],
      nicheAvoidWords: profile ? profile.avoid_words : [],
      nicheTone: profile ? profile.tone : [],
    };
  }

  return {
    generate,
    score,
    resolveNiche: (keywords: string[], industry?: string | null, nicheKey?: string | null) =>
      resolveNiche(keywords, industry, { nicheKey }),
    profileFor,
    scoreContextForNiche,
    selectorNiches: () =>
      data.selectorNicheKeys
        .map((key) => PROFILE_BY_KEY.get(key))
        .filter((p): p is NicheProfileData => Boolean(p && p.selector_visible))
        .map((p) => ({ key: p.key, displayName: p.display_name })),
  };
}
