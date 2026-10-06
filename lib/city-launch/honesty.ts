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
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */

export type HonestyIssueKind = "business_claim" | "location_claim" | "unverified_local";
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
export const LOCAL_FACT_CLAIMS: Array<{ label: string; re: RegExp; support: RegExp; growth?: "up" | "down" }> = [
  { label: "water hardness / quality", re: /\bhard water\b|\bwater hardness\b|\bmineral(s|-rich| content| deposits)?\b|\bcalcium\b|\bwater quality\b/i, support: /hard water|hardness|mineral|calcium|water quality|grains per gallon|gpg/i },
  { label: "climate / weather", re: /\bmonsoon|\bclimate\b(?! control)|\bdesert (heat|sun|conditions|environment)\b|\b(extreme|intense|scorching|summer) (heat|temperatures)\b|\bhot summers?\b|\bmild winters?\b|\bhumid(ity)?\b|\bdrought\b|\brain(fall|y season|storms?)\b|\b\d+\s?(°|degrees)\b|\bfreez(e|es|ing)\b|\bfrozen pipes?\b|\bsnow\b|\bstorms?\b|\bseasons?\b/i, support: /monsoon|climate|heat|summer|winter|humid|drought|rain|freez|snow|storm|season|temperature/i },
  { label: "soil / geology / hazards", re: /\bcaliche\b|\bclay soil\b|\bexpansive soil\b|\bsoil\b|\bgeology\b|\bbedrock\b|\bflood(s|ing|plain)?\b|\bearthquakes?\b|\bhurricanes?\b|\btornado(es)?\b|\bwildfires?\b|\bsinkholes?\b|\btree roots\b/i, support: /caliche|soil|geolog|bedrock|flood|earthquake|hurricane|tornado|wildfire|sinkhole|roots/i },
  { label: "housing age / stock", re: /\bolder homes?\b|\bhistoric (homes?|neighborhoods?|districts?)\b|\baging (homes?|infrastructure|pipes|plumbing)\b|\bbuilt (in|during) the (19|20)\d0s\b|\bnew(er)? (homes?|developments?|construction|builds?|subdivisions?)\b|\bhousing (stock|mix|options|landscape|market)\b/i, support: /older homes|historic|aging|built in|new (homes|construction|developments)|housing/i },
  { label: "regulations / utilities", re: /\bordinances?\b|\bcodes? require\b|\bpermit(s|ting)? (are )?required\b|\bwater restrictions?\b|\brebates?\b/i, support: /ordinance|code|permit|utility|water department|water district|restriction|rebate/i },
  { label: "population growth", re: /\b(rapid|rapidly|fast|steady|steadily|continued|booming|explosive)\s+(growth|growing)\b|\bgrowing (population|community|city)\b|\bpopulation (growth|boom)\b|\bfast-growing\b|\bcontinues to grow\b|\bexpanding (population|community)\b/i, support: /growth|growing/i, growth: "up" },
  { label: "population decline", re: /\b(declining|shrinking) (population|city)\b|\bpopulation (decline|loss)\b/i, support: /declin|shrink/i, growth: "down" },
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

function locationPatterns(cityName: string, businessName?: string): Array<{ label: string; re: RegExp; needsVoice: boolean }> {
  const city = esc(cityName);
  const biz = businessName ? esc(businessName) : "";
  const out: Array<{ label: string; re: RegExp; needsVoice: boolean }> = [
    { label: "\"we are located/based\"", re: /\b(we|we're|we are|we've been|our (team|office|shop|crew|company|business|headquarters))\b[^.!?]*\b(located|based|situated|headquartered)\b/i, needsVoice: false },
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
    out.push({ label: "\"<business> is located/based\"", re: new RegExp(`\\b${biz}\\b[^.!?]*\\b(is|are)\\s+(located|based|situated|headquartered|just|only|about|approximately|right)\\b`, "i"), needsVoice: false });
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
      const hit = asserting.find((s) => !seen.has(s) && pat.re.test(s) && (!pat.needsVoice || voice.test(s)));
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
    if (claim.growth === "up" && typeof input.popChangePct === "number" && input.popChangePct >= 1) continue;
    if (claim.growth === "down" && typeof input.popChangePct === "number" && input.popChangePct <= -1) continue;
    if (!claim.growth && claim.support.test(support)) continue;
    if (claim.growth && claim.support.test(support)) continue;
    const hit = asserting.find((s) => claim.re.test(s) && tie.test(s));
    if (hit) issues.push({ kind: "unverified_local", label: claim.label, sentence: hit });
  }
  return issues;
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
    "- unverified_local: remove the climate / water / soil / housing-age / growth / regulation claim, or replace it with a LOCAL FACTS item (population, county, neighbouring cities, distance from base).",
    "Rewrite only those sentences; keep everything else identical. Return the full JSON again.",
  ].join("\n");
}
