/**
 * Types for the in-process DomainIQ port (generation + scoring).
 * Data shapes mirror DomainIQ's Python dataclasses (snake_case kept where the
 * data is exported verbatim by scripts/domainiq/export-domainiq.py).
 */

export type NicheProfileData = {
  key: string;
  display_name: string;
  aliases: string[];
  positive_words: string[];
  avoid_words: string[];
  avoid_patterns: string[];
  tone: string[];
  buyer_archetypes: string[];
  prefer_short: boolean;
  max_label_length: number;
  min_label_length: number;
  preferred_patterns: string[];
  notes: string;
  seed_keywords: string[];
  selector_visible: boolean;
};

export type ScoringRulesData = Record<string, number>;

export type DomainIQData = {
  source: string;
  wordlists: {
    premiumRoots: string[];
    shortBusinessSuffixes: string[];
    longBusinessSuffixes: string[];
    businessPrefixes: string[];
    trendWords: string[];
    industryTrendWords: Record<string, string[]>;
    brandableEndings: string[];
    maxRootsForCombination: number;
    maxTrendsForCombination: number;
    maxTwoWordPool: number;
  };
  lexicon: {
    modifiers: string[];
    headNouns: string[];
    nicheHeads: Record<string, string[]>;
    compoundTails: string[];
    dictionary: string[];
  };
  phoneticFragments: string[];
  profiles: NicheProfileData[];
  genericProfile: NicheProfileData;
  selectorNicheKeys: string[];
  scoring: {
    weights: Record<
      | "brandability"
      | "commercial_value"
      | "market_demand"
      | "domain_quality"
      | "flip_potential"
      | "risk_penalty",
      string
    >;
    rules: ScoringRulesData;
    premiumTlds: string[];
    secondaryTlds: string[];
    modernTlds: string[];
    trendKeywords: string[];
    highRiskTerms: string[];
    commercialSuffixes: string[];
    brandableEndings: string[];
    lengths: {
      idealMin: number;
      idealMax: number;
      shortMax: number;
      compactMax: number;
      longMin: number;
      extremeMin: number;
    };
    thresholds: {
      strong: string;
      weak: string;
      highRisk: string;
      bandExcellent: string;
      bandStrong: string;
      bandModerate: string;
    };
  };
};

/** Mirrors DomainIQ POST /generate request fields used by the engine. */
export type DomainIQGenerateRequest = {
  keywords?: string[];
  niche?: string | null;
  industry?: string | null;
  style?: "brandable" | "descriptive" | "short" | string | null;
  tlds?: string[];
  count?: number;
};

export type DomainIQSubScores = {
  brandability: number;
  commercial_value: number;
  market_demand: number;
  domain_quality: number;
  flip_potential: number;
  risk_penalty: number;
};

export type DomainIQScoreBand = "excellent" | "strong" | "moderate" | "weak";

/** Mirrors DomainIQ ScoringResult (POST /score breakdown). */
export type DomainIQScore = {
  fullName: string;
  total: number;
  band: DomainIQScoreBand;
  subScores: DomainIQSubScores;
  contributions: DomainIQSubScores;
  summary: string;
  explanation: string;
  highlights: string[];
  concerns: string[];
  nicheFit: number | null;
  nicheKey: string | null;
};

export type DomainIQScoreContext = {
  primaryKeyword?: string | null;
  industry?: string | null;
  nicheKey?: string | null;
  nichePositiveWords?: readonly string[];
  nicheAvoidWords?: readonly string[];
  nicheTone?: readonly string[];
};

export type DomainIQSuggestion = DomainIQScore & { pattern: string; label: string; tld: string };

export type DomainIQGenerateResult = {
  /** Scoring context applied to every candidate (DomainIQ generation metadata). */
  scoreContext: DomainIQScoreContext;
  nicheKey: string | null;
  resolutionSource: "curated" | "fallback_generic" | "none";
  engineKeywords: string[];
  harvestWords: string[];
  primaryKeyword: string;
  style: string;
  /** Every engine candidate in engine order as `label.tld:pattern` (pre-ranking). */
  generatedLabels: string[];
  rejectedCount: number;
  /** Ranked by DomainIQ score, highest first, capped at `count`. */
  top: DomainIQSuggestion[];
  /** All scored candidates (ranked). */
  ranked: DomainIQSuggestion[];
};
