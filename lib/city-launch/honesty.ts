/**
 * City Launch honesty checks (shared by the quality gate and the automatic repair call).
 *
 *  - business_claim     the business asserts a fact it never gave us (licensed, 24/7, years, awards...)
 *  - location_claim     a NON-base city page implies the business is located in / next to that city
 *                       ("we are located in", "we are just 24 miles", "our Chandler office", "your local ...")
 *  - unverified_local   a local environmental / housing / growth "fact" with no source
 *                       (hard water, monsoon, caliche, freezing pipes, older homes, rapid growth...).
 *                       Backed only by VERIFIED LOCAL NOTES the operator supplies, or for growth by the
 *                       Census 2020->2024 population change we pass in.
 *  - geo_claim          a stated distance or compass direction between two places that contradicts the Census
 *                       coordinates ("Glendale, 6 miles southwest of Phoenix" when it is due west).
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */

export type HonestyIssueKind = "business_claim" | "location_claim" | "unverified_local" | "geo_claim";
export type HonestyPlace = { name: string; lat: number; lng: number };
/** The page's city plus the places the copy may position it against (business base, nearest cities). */
export type HonestyGeo = { city: HonestyPlace; places: HonestyPlace[] };
export type HonestyIssue = { kind: HonestyIssueKind; label: string; sentence: string };

export type HonestyInput = {
  text: string;
  cityName: string;
  stateName?: string;
  county?: string;
  baseCity?: string;
  baseState?: string;
  cityState?: string;
  businessName?: string;
  /** Operator-provided facts: website/business context + verified local notes + CSV notes. */
  support?: string;
  /** Census population change 2020->2024 in percent (undefined when unknown). */
  popChangePct?: number;
  /** Population rank of the city among its state's Census places (1 = largest). */
  stateRank?: number;
  geo?: HonestyGeo;
};

function esc(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Business claims an LLM tends to invent; `support` = what in the operator context backs it. */
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

/** Local "facts" that need a source. `support` = what in the operator's verified notes backs it. */
type LocalFactClaim = {
  label: string;
  re: RegExp;
  /** Operator verified notes that back the claim. */
  support: RegExp;
  /** Census-backed check for this exact sentence (growth vs popChangePct, "Nth-largest" vs stateRank). */
  backed?: (sentence: string, input: HonestyInput) => boolean;
};

const ORDINALS: Record<string, number> = { second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };

/** "largest city in Arizona" -> 1, "third-largest" / "3rd largest" -> 3, "one of the largest" -> rank <= 10. */
function rankBacked(sentence: string, input: HonestyInput): boolean {
  const rank = input.stateRank;
  if (!rank) return false;
  const m = /\b(one of the\s+)?(?:(\d+)(?:st|nd|rd|th)|(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth))?[- ]?(largest|biggest|most populous)\b/i.exec(sentence);
  if (!m) return false;
  if (/\b(fastest|safest|best|oldest|newest|known for|famous|renowned)\b/i.test(sentence)) return false;
  if (m[1]) return rank <= 10;
  const stated = m[2] ? Number(m[2]) : m[3] ? ORDINALS[m[3].toLowerCase()] : 1;
  return stated === rank;
}

const growthAtLeast = (pct: number) => (_s: string, input: HonestyInput) => typeof input.popChangePct === "number" && input.popChangePct >= pct;

export const LOCAL_FACT_CLAIMS: LocalFactClaim[] = [
  { label: "water hardness / quality", re: /\bhard water\b|\bwater hardness\b|\bmineral(s|-rich| content| deposits)?\b|\bcalcium\b|\bwater quality\b/i, support: /hard water|hardness|mineral|calcium|water quality|grains per gallon|gpg/i },
  { label: "climate / weather", re: /\bmonsoon|\bclimate\b(?! control)|\bdesert (heat|sun|conditions|environment)\b|\b(extreme|intense|scorching|summer) (heat|temperatures)\b|\bhot summers?\b|\bmild winters?\b|\bhumid(ity)?\b|\bdrought\b|\brain(fall|y season|storms?)\b|\b\d+\s?(°|degrees)\b|\bfreez(e|es|ing)\b|\bfrozen pipes?\b|\bsnow\b|\bstorms?\b|\bseasons?\b/i, support: /monsoon|climate|heat|summer|winter|humid|drought|rain|freez|snow|storm|season|temperature/i },
  { label: "soil / geology / hazards", re: /\bcaliche\b|\bclay soil\b|\bexpansive soil\b|\bsoil\b|\bgeology\b|\bbedrock\b|\bflood(s|ing|plain)?\b|\bearthquakes?\b|\bhurricanes?\b|\btornado(es)?\b|\bwildfires?\b|\bsinkholes?\b|\btree roots\b/i, support: /caliche|soil|geolog|bedrock|flood|earthquake|hurricane|tornado|wildfire|sinkhole|roots/i },
  { label: "housing age / stock", re: /\bolder homes?\b|\bhistoric (homes?|neighborhoods?|districts?)\b|\baging (homes?|infrastructure|pipes|plumbing)\b|\bbuilt (in|during) the (19|20)\d0s\b|\bnew(er)? (homes?|developments?|construction|builds?|subdivisions?)\b|\bhousing (stock|mix|options|landscape|market)\b/i, support: /older homes|historic|aging|built in|new (homes|construction|developments)|housing/i },
  { label: "regulations / utilities", re: /\bordinances?\b|\bcodes? require\b|\bpermit(s|ting)? (are )?required\b|\bwater restrictions?\b|\brebates?\b/i, support: /ordinance|code|permit|utility|water department|water district|restriction|rebate/i },
  // Census 2020->2024: "growing" needs >= +1%; "rapid / booming" needs >= +8% (about 2% a year).
  { label: "rapid population growth", re: /\b(rapid|rapidly|fast|booming|explosive|dramatic)\s+(growth|growing|expansion)\b|\bfast-growing\b|\bpopulation boom\b|\bgrowing rapidly\b|\bgrown rapidly\b/i, support: /rapid|fast-growing|booming/i, backed: growthAtLeast(8) },
  { label: "population growth", re: /\b(steady|steadily|continued)\s+(growth|growing)\b|\bgrowing (population|community|city)\b|\bpopulation growth\b|\bcontinues to grow\b|\bexpanding (population|community)\b/i, support: /growth|growing/i, backed: growthAtLeast(1) },
  { label: "rankings / reputation", re: /\b(fastest|largest|biggest|oldest|newest|safest|best|most (popular|desirable|affluent|populous))[- ](growing\s+)?(city|cities|town|towns|suburbs?|communit(y|ies)|places?|areas?)\b|\bfastest[- ]growing\b|\b(known|famous|renowned|celebrated|recognized) for\b/i, support: /fastest|largest|biggest|oldest|safest|best|known for|famous|renowned|celebrated|recognized/i, backed: rankBacked },
  { label: "population decline", re: /\b(declining|shrinking) (population|city)\b|\bpopulation (decline|loss)\b/i, support: /declin|shrink/i, backed: (_s, input) => typeof input.popChangePct === "number" && input.popChangePct <= -1 },
];

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Sentences that only invite the reader to ask/confirm, or are questions, assert nothing. */
const INVITATION = /\b(ask|inquire|enquire|confirm|check with us|questions? about)\b/i;
const isQuestion = (s: string) => /\?\s*$/.test(s);

function voiceRe(businessName?: string): RegExp {
  return new RegExp(`\\b(we|we're|we've|we'll|our|ours|us)\\b${businessName ? `|${esc(businessName)}` : ""}`, "i");
}

export function isBaseCity(input: Pick<HonestyInput, "cityName" | "baseCity" | "baseState" | "cityState">): boolean {
  if (!input.baseCity) return false;
  const sameName = input.baseCity.trim().toLowerCase() === input.cityName.trim().toLowerCase();
  const sameState = !input.baseState || !input.cityState || input.baseState.trim().toUpperCase() === input.cityState.trim().toUpperCase();
  return sameName && sameState;
}

/** "we are based in Phoenix" is true on every page when Phoenix is the base: only the named place matters. */
function namesBase(sentence: string, re: RegExp, baseCity?: string): boolean {
  if (!baseCity) return false;
  const m = re.exec(sentence);
  if (!m) return false;
  const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase();
  return after.includes(baseCity.trim().toLowerCase());
}

function locationPatterns(cityName: string, businessName?: string): Array<{ label: string; re: RegExp; needsVoice: boolean; okIfBase?: boolean }> {
  const city = esc(cityName);
  const biz = businessName ? esc(businessName) : "";
  const out: Array<{ label: string; re: RegExp; needsVoice: boolean; okIfBase?: boolean }> = [
    { label: "\"we are located/based\"", re: /\b(we|we're|we are|we've been|our (team|office|shop|crew|company|business|headquarters))\s+((are|is|were|have been|has been|'re|'ve been)\s+)?(\w+ly\s+)?(located|based|situated|headquartered)\s+(in|at|near|right|just|close|on)\b/i, needsVoice: false, okIfBase: true },
    { label: "\"we are just/about X miles\"", re: /\bwe('re| are)\s+(just|only|about|approximately|around|roughly|right|conveniently|centrally|close|near|nearby|minutes|a short|\d)/i, needsVoice: false },
    { label: "\"our team is just/nearby\"", re: /\bour\s+(team|crew|technicians?|plumbers?|electricians?|staff|experts?|pros|professionals|trucks?|vans?)\s+(is|are)\s+(just|only|about|close|nearby|near|right|minutes|a short|stationed|located|based)\b/i, needsVoice: false },
    { label: "\"our office/shop/location\"", re: /\bour\s+(\w+\s){0,2}(office|shop|storefront|location|branch|headquarters|hq|showroom|warehouse|facility|yard)s?\b/i, needsVoice: false },
    { label: `"our ${cityName} ..."`, re: new RegExp(`\\bour\\s+${city}\\b`, "i"), needsVoice: false },
    { label: "\"our city/community\"", re: /\bour (city|town|community|neighbou?rs|neighbou?rhoods?|area)\b/i, needsVoice: false },
    { label: "\"your local ...\"", re: /\byour (local|neighborhood|neighbourhood|hometown)\b/i, needsVoice: true },
    { label: `"local to / in the heart of ${cityName}"`, re: new RegExp(`\\b(local to|in the heart of|right here in|here in|based in|located in|headquartered in)\\s+(downtown\\s+)?${city}\\b`, "i"), needsVoice: true },
    { label: "\"right here / around the corner\"", re: /\b(right here|around the corner|down the street|in your backyard)\b/i, needsVoice: true },
  ];
  if (biz) {
    out.push({ label: "\"<business> is located/based\"", re: new RegExp(`\\b${biz}(,[^,]{0,40},)?\\s+(is|are)\\s+(\\w+ly\\s+)?(located|based|situated|headquartered)\\b`, "i"), needsVoice: false, okIfBase: true });
    out.push({ label: "\"<business> is just X miles\"", re: new RegExp(`\\b${biz}(,[^,]{0,40},)?\\s+(is|are)\\s+(just|only|about|approximately|around|roughly|right|conveniently|close|nearby|minutes)\\b(?!\\s+(a call|a phone call|one call|a click))`, "i"), needsVoice: false });
  }
  return out;
}

export function findHonestyIssues(input: HonestyInput): HonestyIssue[] {
  const support = input.support || "";
  const voice = voiceRe(input.businessName);
  const issues: HonestyIssue[] = [];
  const all = sentencesOf(input.text);
  const asserting = all.filter((s) => !INVITATION.test(s) && !isQuestion(s));

  // 1. business claims (business voice only)
  const voiced = asserting.filter((s) => voice.test(s));
  for (const claim of BUSINESS_CLAIMS) {
    if (claim.support.test(support)) continue;
    const hit = voiced.find((s) => claim.re.test(s));
    if (hit) issues.push({ kind: "business_claim", label: claim.label, sentence: hit });
  }

  // 2. location claims on pages for cities that are not the business's base
  if (!isBaseCity(input)) {
    const seen = new Set<string>();
    for (const pat of locationPatterns(input.cityName, input.businessName)) {
      const hit = asserting.find(
        (s) => !seen.has(s) && pat.re.test(s) && (!pat.needsVoice || voice.test(s)) && !(pat.okIfBase && namesBase(s, pat.re, input.baseCity))
      );
      if (hit) {
        seen.add(hit);
        issues.push({ kind: "location_claim", label: pat.label, sentence: hit });
      }
    }
  }

  // 3. unverified local facts: only sentences tied to the place (city/county/state/"the area"/"local"...)
  const placeTerms = [input.cityName, input.county?.replace(/\s+(County|Parish|Borough)$/i, ""), input.stateName].filter(Boolean).map((t) => esc(t!));
  const tie = new RegExp(`\\b(${[...placeTerms, "area", "local", "locally", "region", "regional", "here", "residents", "community", "neighborhoods?", "homeowners in", "city", "town"].join("|")})\\b`, "i");
  for (const claim of LOCAL_FACT_CLAIMS) {
    if (claim.support.test(support)) continue;
    const hit = asserting.find((s) => claim.re.test(s) && tie.test(s) && !(claim.backed && claim.backed(s, input)));
    if (hit) issues.push({ kind: "unverified_local", label: claim.label, sentence: hit });
  }
  // 4. distances / directions between known places must match the Census coordinates
  if (input.geo) {
    const seen = new Set<string>();
    for (const sentence of all) {
      const problem = checkGeoSentence(sentence, input.geo);
      if (problem && !seen.has(sentence)) {
        seen.add(sentence);
        issues.push({ kind: "geo_claim", label: problem, sentence });
      }
    }
  }
  return issues;
}

/* ------------------------------ geo check ------------------------------ */

const DIRECTION_DEG: Record<string, number> = {
  north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315,
};
const GEO_RE = /(?:(\d+(?:\.\d+)?)\s*(?:-\s*)?miles?\s+(?:to the\s+)?|\bto the\s+)((?:north|south)(?:[- ]?(?:east|west))?|east|west)\b(?:\s+of\s+(?:downtown\s+)?([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}))?/gi;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function milesBetween(a: HonestyPlace, b: HonestyPlace): number {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Initial compass bearing from a to b in degrees (0 = north, 90 = east). */
export function bearingDeg(a: HonestyPlace, b: HonestyPlace): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function angleDiff(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Stated direction may be off by at most 45 degrees (the right octant or a neighbour near the boundary). */
export const GEO_DIRECTION_TOLERANCE_DEG = 45;

function checkGeoSentence(sentence: string, geo: HonestyGeo): string | null {
  const known = [geo.city, ...geo.places].filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const lower = sentence.toLowerCase();
  GEO_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GEO_RE.exec(sentence))) {
    const miles = m[1] ? Number(m[1]) : null;
    const dir = m[2].toLowerCase().replace(/[- ]/g, "");
    const deg = DIRECTION_DEG[dir];
    if (deg === undefined) continue;
    let ref: HonestyPlace | undefined;
    if (m[3]) {
      const named = m[3].toLowerCase().replace(/[.'-]+$/, "");
      ref = known.find((p) => named === p.name.toLowerCase() || named.startsWith(`${p.name.toLowerCase()} `));
      if (!ref) continue; // "of the freeway", "of an unknown place": not checkable
    }
    // subject = the last known place named before the distance phrase (other than the reference)
    const before = lower.slice(0, m.index);
    let subject: HonestyPlace | undefined;
    let at = -1;
    for (const p of known) {
      if (ref && p === ref) continue;
      const i = before.lastIndexOf(p.name.toLowerCase());
      if (i > at) {
        at = i;
        subject = p;
      }
    }
    if (!subject) subject = geo.city;
    if (!ref) ref = subject === geo.city ? undefined : geo.city;
    if (!ref || ref === subject) continue;
    const actualDeg = bearingDeg(ref, subject);
    const actualMiles = milesBetween(ref, subject);
    if (angleDiff(actualDeg, deg) > GEO_DIRECTION_TOLERANCE_DEG) {
      return `direction: ${subject.name} is ${compass(actualDeg)} of ${ref.name}, not ${dir}`;
    }
    if (miles !== null && Math.abs(miles - actualMiles) > Math.max(3, actualMiles * 0.3)) {
      return `distance: ${subject.name} is about ${Math.round(actualMiles)} miles from ${ref.name}, not ${miles}`;
    }
  }
  return null;
}

function compass(deg: number): string {
  const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return names[Math.round(deg / 45) % 8];
}

/** Back-compat helper: business claims only, as "label: sentence" strings. */
export function unsupportedClaims(text: string, context: string, businessName = ""): string[] {
  return findHonestyIssues({ text, cityName: "\u0000", businessName, support: context, baseCity: "\u0000" })
    .filter((i) => i.kind === "business_claim")
    .map((i) => `${i.label}: "${i.sentence.slice(0, 140)}"`);
}

export function describeIssues(issues: HonestyIssue[]): string {
  const by = (k: HonestyIssueKind) => issues.filter((i) => i.kind === k);
  const parts: string[] = [];
  const fmt = (list: HonestyIssue[]) => list.map((i) => `${i.label}: "${i.sentence.slice(0, 140)}"`).join("; ");
  if (by("business_claim").length) parts.push(`Unverified business claim (not in the business context): ${fmt(by("business_claim"))}.`);
  if (by("location_claim").length) parts.push(`Implies the business is located in or next to this city (it serves it from its base): ${fmt(by("location_claim"))}.`);
  if (by("geo_claim").length) parts.push(`Distance or direction contradicts the Census coordinates: ${fmt(by("geo_claim"))}.`);
  if (by("unverified_local").length) parts.push(`Unverified local fact (add it with a source to "Verified local notes", or remove it): ${fmt(by("unverified_local"))}.`);
  return parts.join(" ");
}

/** Instructions for the automatic repair call. */
export function repairInstructions(issues: HonestyIssue[], cityName: string, baseLabel: string): string {
  const lines = issues.map((i) => `- [${i.kind}] ${i.label}: "${i.sentence.slice(0, 220)}"`);
  return [
    "Some sentences in your JSON are not allowed:",
    ...lines,
    "Fix rules:",
    "- business_claim: do not assert the fact; e.g. \"Ask us about licensing and insurance when you call.\"",
    `- location_claim: the business is based in ${baseLabel || "its base city"} and SERVES ${cityName} from there. Write e.g. "We serve ${cityName} from our ${baseLabel || "base"} base" or state distances as facts about the city ("${cityName} is about N miles ... of ${baseLabel || "our base"}"). Never "we are located/just N miles/your local".`,
    "- geo_claim: use exactly the directions and distances given in LOCAL FACTS (or leave the direction out).",
    "- unverified_local: remove the climate / water / soil / housing-age / growth / regulation claim, or replace it with a LOCAL FACTS item (population, county, neighbouring cities, distance from base).",
    "Rewrite only those sentences; keep everything else identical. Return the full JSON again.",
  ].join("\n");
}
