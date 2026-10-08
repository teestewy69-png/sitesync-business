"""Export DomainIQ's pure generation/scoring data + golden parity fixtures for Sitesinc.

Run with DomainIQ's own Python (its venv) so the data and fixtures come from the
real engine, not a copy:

    <DOMAINIQ>/.venv/Scripts/python.exe scripts/domainiq/export-domainiq.py <DOMAINIQ_DIR>

Writes:
  lib/domainiq/data.generated.ts         (word lists, lexicon, niche profiles, scoring rules)
  scripts/fixtures/domainiq-golden.json  (real DomainIQ outputs the TS port must match)

Only deterministic, offline parts are exported. Live/rotating inputs (hot-niche
rotation by UTC date, live trends, sale-history harvest, liquidity/flip blend,
trademark prescreen, RDAP oversampling) are intentionally excluded so the port
is reproducible and needs no server or keys.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, replace
from decimal import Decimal

ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DOMAINIQ_DIR", ""))
if not ROOT or not os.path.isdir(os.path.join(ROOT, "app")):
    raise SystemExit("Pass the DomainIQ project dir (the one containing app/).")
sys.path.insert(0, ROOT)
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.generation import lexicon, niche_harvest, wordlists  # noqa: E402
from app.services.generation.engine import DomainGenerationEngine  # noqa: E402
from app.services.generation.lexicon import niche_words  # noqa: E402
from app.services.generation.niche_intelligence import profiles, resolve_niche  # noqa: E402
from app.services.generation.niche_intelligence.resolver import GENERIC_BRANDABLE  # noqa: E402
from app.services.generation.types import GenerationOptions  # noqa: E402
from app.services.scoring import weights as W  # noqa: E402
from app.services.scoring.engine import score_domain  # noqa: E402
from app.utils.domain_helpers import build_full_name  # noqa: E402

# Hot-niche words rotate by UTC date; exclude them so output is reproducible.
niche_harvest.harvest_from_optional_provider = lambda keywords, niche: []


def jsonable(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        return sorted(jsonable(v) for v in value)
    return value


def profile_dict(profile):
    return jsonable(asdict(profile))


wl = wordlists.DEFAULT_WORD_LISTS
DATA = {
    "source": "DomainIQ app/services (generation + scoring), exported by scripts/domainiq/export-domainiq.py",
    "wordlists": {
        "premiumRoots": list(wl.premium_roots),
        "shortBusinessSuffixes": list(wl.short_business_suffixes),
        "longBusinessSuffixes": list(wl.long_business_suffixes),
        "businessPrefixes": list(wl.business_prefixes),
        "trendWords": list(wl.trend_words),
        "industryTrendWords": {k: list(v) for k, v in wl.industry_trend_words.items()},
        "brandableEndings": list(wl.brandable_endings),
        "maxRootsForCombination": wl.max_roots_for_combination,
        "maxTrendsForCombination": wl.max_trends_for_combination,
        "maxTwoWordPool": wl.max_two_word_pool,
    },
    "lexicon": {
        "modifiers": list(lexicon.MODIFIERS),
        "headNouns": list(lexicon.HEAD_NOUNS),
        "nicheHeads": {k: list(v) for k, v in lexicon.NICHE_HEADS.items()},
        "compoundTails": list(lexicon.COMPOUND_TAILS),
        "dictionary": sorted(lexicon.DICTIONARY),
    },
    "phoneticFragments": list(niche_harvest.PHONETIC_FRAGMENTS),
    "profiles": [profile_dict(p) for p in profiles.NICHE_PROFILES],
    "genericProfile": profile_dict(GENERIC_BRANDABLE),
    "selectorNicheKeys": list(profiles.SELECTOR_NICHE_KEYS),
    "scoring": {
        "weights": {k: str(getattr(W.DEFAULT_WEIGHTS, k)) for k in (
            "brandability", "commercial_value", "market_demand", "domain_quality",
            "flip_potential", "risk_penalty")},
        "rules": asdict(W.DEFAULT_RULES),
        "premiumTlds": sorted(W.PREMIUM_TLDS),
        "secondaryTlds": sorted(W.SECONDARY_TLDS),
        "modernTlds": sorted(W.MODERN_TLDS),
        "trendKeywords": sorted(W.TREND_KEYWORDS),
        "highRiskTerms": sorted(W.HIGH_RISK_TERMS),
        "commercialSuffixes": sorted(W.COMMERCIAL_SUFFIXES),
        "brandableEndings": list(W.BRANDABLE_ENDINGS),
        "lengths": {
            "idealMin": W.IDEAL_LENGTH_MIN, "idealMax": W.IDEAL_LENGTH_MAX,
            "shortMax": W.SHORT_LENGTH_MAX, "compactMax": W.COMPACT_LENGTH_MAX,
            "longMin": W.LONG_LENGTH_MIN, "extremeMin": W.EXTREME_LENGTH_MIN,
        },
        "thresholds": {
            "strong": str(W.STRONG_SCORE), "weak": str(W.WEAK_SCORE), "highRisk": str(W.HIGH_RISK),
            "bandExcellent": str(W.SCORE_BAND_EXCELLENT), "bandStrong": str(W.SCORE_BAND_STRONG),
            "bandModerate": str(W.SCORE_BAND_MODERATE),
        },
    },
}


def score_payload(full_name, **kwargs):
    r = score_domain(full_name, **kwargs)
    return {
        "fullName": full_name,
        "total": str(r.total_score),
        "band": r.score_band,
        "subScores": {k: str(v) for k, v in asdict(r.sub_scores).items()},
        "contributions": {k: str(v) for k, v in r.weighted_contributions.items()},
        "summary": r.summary,
        "explanation": r.explanation,
        "highlights": list(r.highlights),
        "concerns": list(r.concerns),
        "nicheFit": str(r.niche_fit) if r.niche_fit is not None else None,
        "nicheKey": r.niche_key,
    }


def run_generate(req):
    """Mirror GenerationService.generate (attempt 1) minus live/rotating inputs and RDAP."""
    keywords = [k.strip().lower() for k in req.get("keywords", []) if k and k.strip()]
    niche = req.get("niche")
    if niche is not None:
        niche = niche.strip().lower().replace(" ", "_").replace("-", "_") or None
    industry = req.get("industry")
    tlds = [t.strip().lower().lstrip(".") for t in req.get("tlds", ["com"]) if t.strip()] or ["com"]
    count = int(req.get("count", 10))

    resolution = resolve_niche(keywords, industry or niche, niche_key=niche)
    profile = resolution.profile
    user_keywords = list(dict.fromkeys(keywords))
    seeds = profile.generation_seeds(8) if profile else []
    extras = []
    if profile is not None:
        seed_set = set(seeds)
        extras = [w for w in profile.positive_words if w and w not in seed_set][:8]
    if user_keywords:
        engine_keywords = list(dict.fromkeys([*user_keywords, *seeds, *extras]))[:16]
    else:
        engine_keywords = list(dict.fromkeys([*seeds, *extras]))[:16] or (["brand"] if not niche else [niche])
    trend_industry = niche or industry
    harvest = niche_harvest.harvest_niche_words(
        engine_keywords, industry=trend_industry, extra_words=[], resolution=resolution
    )
    style = req.get("style") or "brandable"
    if style == "brandable":
        pmax = profile.max_label_length if profile else 14
        pmin = profile.min_label_length if profile else 6
        max_len = max(12, min(14, pmax))
        min_len = min(6, max(5, pmin))
    else:
        max_len, min_len = 15, 3
    preferred = ("two_word",)
    if profile is not None:
        preferred = ("two_word",) + tuple(p for p in profile.preferred_patterns if p != "two_word")
    batch = min(max(count * 12, 64), 240)
    attempt_preferred = tuple(dict.fromkeys(("two_word", "keyword_trend", *preferred)))
    options = GenerationOptions(
        keywords=engine_keywords, tlds=tlds, count=batch, collect_limit=batch, style=style,
        industry=trend_industry or harvest.niche, max_label_length=max_len, min_label_length=min_len,
        use_trends=False, trend_words=harvest.words, trend_keywords_used=[],
        excluded_full_names=frozenset(), niche_key=harvest.niche,
        niche_avoid_words=tuple(profile.avoid_words) if profile else (),
        niche_avoid_patterns=tuple(profile.avoid_patterns) if profile else (),
        niche_preferred_patterns=attempt_preferred,
        niche_positive_words=tuple(profile.positive_words) if profile else (),
        niche_tone=tuple(profile.tone) if profile else (),
        niche_buyer_archetypes=tuple(profile.buyer_archetypes) if profile else (),
    )
    result = DomainGenerationEngine().generate(options)
    primary = user_keywords[0] if user_keywords else engine_keywords[0]
    nk = harvest.niche
    terms = frozenset({*options.niche_positive_words, *niche_words(nk)}) if nk or options.niche_positive_words else ()
    scoring_words = tuple(sorted(terms))
    scored = []
    for c in result.candidates:
        payload = score_payload(
            build_full_name(c.name, c.tld), primary_keyword=primary, industry=nk, niche_key=nk,
            niche_positive_words=scoring_words, niche_avoid_words=options.niche_avoid_words,
            niche_tone=options.niche_tone,
        )
        payload["pattern"] = c.pattern
        scored.append(payload)
    scored.sort(key=lambda p: Decimal(p["total"]), reverse=True)
    return {
        "nicheKey": nk,
        "resolutionSource": resolution.source,
        "engineKeywords": engine_keywords,
        "harvestWords": harvest.words,
        "primaryKeyword": primary,
        "style": style,
        "generatedLabels": [f"{c.name}.{c.tld}:{c.pattern}" for c in result.candidates],
        "rejectedCount": result.rejected_count,
        "top": scored[:count],
    }


GEN_CASES = [
    {"id": "plumbing-brandable", "request": {"niche": "plumbing", "industry": "plumbing", "count": 12}},
    {"id": "plumbing-local-phoenix", "request": {"niche": "plumbing", "industry": "plumbing", "style": "descriptive",
        "keywords": ["desertflowplumbing", "phoenix", "plumbing", "desertflow", "az"], "count": 12}},
    {"id": "roofing-local-austin", "request": {"niche": "roofing", "industry": "Roofing", "style": "descriptive",
        "keywords": ["austin", "roofing"], "count": 8}},
    {"id": "unknown-niche-generic", "request": {"niche": "dog grooming", "industry": "dog grooming", "count": 8}},
    {"id": "hvac-brandable", "request": {"niche": "HVAC", "industry": "HVAC", "count": 8}},
]
SCORE_CASES = [
    {"id": "plain-com", "fullName": "phoenixplumbing.com", "kwargs": {}},
    {"id": "niche-com", "fullName": "phoenixplumbing.com", "kwargs": {"primary_keyword": "plumbing", "industry": "plumbing", "niche_key": "plumbing"}},
    {"id": "risky", "fullName": "googleplumb.net", "kwargs": {"primary_keyword": "plumbing"}},
    {"id": "hyphen-digit", "fullName": "best-plumber24.biz", "kwargs": {}},
    {"id": "short-io", "fullName": "flowly.io", "kwargs": {}},
]

golden = {
    "generate": [{**case, "expected": run_generate(case["request"])} for case in GEN_CASES],
    "score": [{**case, "expected": score_payload(case["fullName"], **case["kwargs"])} for case in SCORE_CASES],
}

data_path = os.path.join(REPO, "lib", "domainiq", "data.generated.ts")
os.makedirs(os.path.dirname(data_path), exist_ok=True)
with open(data_path, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("// AUTO-GENERATED from DomainIQ by scripts/domainiq/export-domainiq.py - do not edit by hand.\n")
    fh.write('import type { DomainIQData } from "./types";\n\n')
    fh.write("export const DOMAINIQ_DATA: DomainIQData = ")
    fh.write(json.dumps(DATA, indent=2, ensure_ascii=True))
    fh.write(";\n")

golden_path = os.path.join(REPO, "scripts", "fixtures", "domainiq-golden.json")
os.makedirs(os.path.dirname(golden_path), exist_ok=True)
with open(golden_path, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(golden, fh, indent=2, ensure_ascii=True)
    fh.write("\n")

print(f"wrote {data_path}")
print(f"wrote {golden_path}")
for case in golden["generate"]:
    top = case["expected"]["top"]
    print(case["id"], case["expected"]["nicheKey"], len(case["expected"]["generatedLabels"]), [f"{t['fullName']}={t['total']}" for t in top[:5]])
