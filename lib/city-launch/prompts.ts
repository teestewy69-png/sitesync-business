/**
 * City Launch writing prompts - TypeScript port of ScaleQuan Content Studio's batch writer
 * (backend/server.py: GenerateBatchInput, fill_placeholders, generate_article, generate_faq;
 * frontend ContentStudio.jsx defaults), extended for animated landing pages:
 *   - same {keyword} / {city} / {state} placeholders, title + prompt templates, competitor gaps,
 *     business/website context, target word count, optional FAQ, 500-row cap;
 *   - structured JSON output (hero, sections, local highlights, FAQ, CTA) instead of one HTML blob;
 *   - real Census facts per city (population, county, distance/direction to nearby cities) so every page
 *     has genuinely local grounding, plus hard rules against invented business claims.
 * ScaleQuan's heuristic (non-AI) fallback is intentionally NOT ported: no key = no draft, never fake copy.
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */

export const DEFAULT_TITLE_TEMPLATE = "{keyword} in {city}, {state}";
export const DEFAULT_PROMPT_TEMPLATE =
  "Write a helpful, locally-relevant landing page for {keyword} in {city}, {state}. Use a friendly expert tone.";
export const DEFAULT_TARGET_WORDS = 800;
export const MIN_TARGET_WORDS = 300;
export const MAX_TARGET_WORDS = 1500;

export type CityPageSection = { heading: string; body: string };
export type CityPageFaq = { question: string; answer: string };

/** The structured content of one city landing page (what the LLM writes and the operator edits). */
export type CityPageContent = {
  title: string;
  metaDescription: string;
  h1: string;
  heroSubhead: string;
  intro: string;
  sections: CityPageSection[];
  localHighlights: string[];
  faq: CityPageFaq[];
  ctaHeadline: string;
  ctaText: string;
};

export type CityPromptCity = {
  name: string;
  state: string;
  stateName: string;
  county?: string;
  population?: number;
  keyword?: string;
  notes?: string;
};

export type CityPromptNearby = { name: string; state: string; distanceMiles: number; direction: string; population?: number };

export type CityPromptBusiness = {
  businessName: string;
  niche: string;
  phone?: string;
  baseCity?: string;
  baseState?: string;
  primaryGoal?: string;
  notes?: string;
};

export type CityPromptSettings = {
  keyword: string;
  titleTemplate: string;
  promptTemplate: string;
  competitorGaps: string;
  websiteContent: string;
  targetWordCount: number;
  includeFaq: boolean;
};

/** ScaleQuan fill_placeholders. */
export function fillPlaceholders(tpl: string, city: string, state: string, keyword: string): string {
  return String(tpl || "")
    .split("{city}")
    .join(city)
    .split("{state}")
    .join(state)
    .split("{keyword}")
    .join(keyword);
}

export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function clampTargetWords(n: unknown): number {
  const v = Math.round(Number(n) || DEFAULT_TARGET_WORDS);
  return Math.max(MIN_TARGET_WORDS, Math.min(MAX_TARGET_WORDS, v));
}

export function pageTitleFor(settings: CityPromptSettings, city: CityPromptCity): string {
  const keyword = city.keyword || settings.keyword;
  return capitalizeFirst(
    fillPlaceholders(settings.titleTemplate || DEFAULT_TITLE_TEMPLATE, city.name, city.state, keyword).trim()
  ).slice(0, 120);
}

export function systemPrompt(settings: CityPromptSettings, city: CityPromptCity): string {
  const kw = city.keyword || settings.keyword;
  const wc = clampTargetWords(settings.targetWordCount);
  return [
    "You are an expert local-SEO content writer. Return ONLY JSON (no prose, no code fences) with this shape:",
    '{"metaDescription": string (120-155 chars), "h1": string, "heroSubhead": string (1 sentence),',
    ' "intro": string (2-3 sentences), "sections": [{"heading": string, "body": string}] (4-6 items),',
    ' "localHighlights": [string] (3-5 short, city-specific points), ' +
      (settings.includeFaq ? '"faq": [{"question": string, "answer": string}] (4-5 items), ' : '"faq": [], ') +
      '"ctaHeadline": string, "ctaText": string (1-2 sentences)}',
    `Write about ${wc} words in total (at least ${Math.round(wc * 0.85)}; section bodies are 2 short paragraphs each), localized to ${city.name}, ${city.state}, targeting the keyword '${kw}'.`,
    "Address the competitor gaps provided and reflect the business/website context.",
    "Plain text inside every string: no HTML, no markdown headings. Separate paragraphs inside a section body with a blank line; a list item may start with '- '.",
    "",
    "UNIQUENESS RULES (pages for many cities are generated; each must stand on its own):",
    `- Ground the page in ${city.name} specifically: use the LOCAL FACTS block (population, county, where it sits relative to nearby cities) and well-known, verifiable local context that genuinely affects this service (climate and seasons, geography, water, typical housing age and construction, growth, local regulations or utilities).`,
    "- Pick section headings and an angle that fit THIS city. Do not use a generic skeleton like 'Why choose us' / 'Our services' / 'Contact us'.",
    "- Never write a page that would still make sense after swapping the city name for another city.",
    `- Name the county and at least two of the listed nearest cities (with their real direction) in the body, e.g. in a service-area section, and use the distance from the business base when given.`,
    "- Region-wide generalities (desert heat, hard water, monsoon, freezing winters...) may appear at most once; spend the page on what is particular to this city (its size, position relative to its neighbours, county, growth and housing mix as far as you reliably know them).",
    "- If you are not sure a local detail is true, leave it out. Do not invent neighborhoods, landmarks, statistics or ordinances.",
    "",
    "HONESTY RULES (about the business):",
    "- Only state business facts given in BUSINESS / WEBSITE CONTEXT. Do not invent license numbers, years in business, prices, discounts, guarantees, warranties, response times, awards, reviews, testimonials, staff names, or a physical office in this city.",
    "- Describe the service area honestly: the business serves this city from its base location unless the context says otherwise.",
    "- Write as the business serving this city (\"serving <city>\", \"in <city>\"). Unless this IS the base city, never write \"our city\", \"our community\" or \"our neighbors\", and never imply an office, shop or crew based in this city.",
  ].join("\n");
}

function fmtPop(n?: number): string {
  return n && n > 0 ? n.toLocaleString("en-US") : "unknown";
}

export function userPrompt(
  settings: CityPromptSettings,
  city: CityPromptCity,
  business: CityPromptBusiness,
  nearby: CityPromptNearby[],
  fromBase?: { distanceMiles: number; direction: string } | null
): string {
  const kw = city.keyword || settings.keyword;
  const instructions = fillPlaceholders(settings.promptTemplate || DEFAULT_PROMPT_TEMPLATE, city.name, city.state, kw);
  const gaps = [city.notes, settings.competitorGaps].filter(Boolean).join("\n");
  const base = [business.baseCity, business.baseState].filter(Boolean).join(", ");
  const facts = [
    `City: ${city.name}, ${city.stateName} (${city.state})`,
    city.county ? `County: ${city.county}` : "",
    `Population (U.S. Census Vintage 2024 estimate): ${fmtPop(city.population)}`,
    base
      ? fromBase && fromBase.distanceMiles > 0.5
        ? `Business base: ${base}; ${city.name} is about ${Math.round(fromBase.distanceMiles)} miles ${fromBase.direction} of it`
        : `Business base: ${base}${fromBase ? ` (this is the base city)` : ""}`
      : "",
    nearby.length
      ? `Nearest other cities: ${nearby
          .map((n) => `${n.name} (${Math.round(n.distanceMiles)} mi ${n.direction})`)
          .join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    `KEYWORD: ${kw}`,
    `CITY: ${city.name}`,
    `STATE: ${city.state}`,
    "",
    "LOCAL FACTS (verified, from U.S. Census data):",
    facts,
    "",
    "COMPETITOR GAPS TO COVER:",
    gaps || "(none provided)",
    "",
    "BUSINESS / WEBSITE CONTEXT:",
    settings.websiteContent || defaultWebsiteContent(business),
    "",
    "INSTRUCTIONS:",
    instructions,
  ].join("\n");
}

export function defaultWebsiteContent(business: CityPromptBusiness): string {
  return [
    `${business.businessName} - ${business.niche || "local service"} business`,
    business.baseCity ? `Based in ${[business.baseCity, business.baseState].filter(Boolean).join(", ")}.` : "",
    business.phone ? `Phone: ${business.phone}.` : "",
    business.primaryGoal ? `Primary goal of the website: ${business.primaryGoal}.` : "",
    business.notes ? `Notes from intake: ${business.notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------ parsing ------------------------------ */

export class CityContentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CityContentError";
    this.code = code;
  }
}

function str(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.replace(/\r/g, "").trim().slice(0, max) : "";
}

/** Extract the first JSON object from a model reply (ScaleQuan: re.search(r"\{.*\}", content, re.DOTALL)). */
export function extractJsonObject(content: string): unknown {
  const text = String(content || "").replace(/^```(?:json)?/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new CityContentError("bad_json", "Model reply contained no JSON object.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new CityContentError("bad_json", "Model reply JSON did not parse.");
  }
}

export function countWords(text: string): number {
  return String(text || "")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

export function contentText(content: CityPageContent): string {
  return [
    content.h1,
    content.heroSubhead,
    content.intro,
    ...content.sections.flatMap((s) => [s.heading, s.body]),
    ...content.localHighlights,
    ...content.faq.flatMap((f) => [f.question, f.answer]),
    content.ctaHeadline,
    content.ctaText,
  ].join("\n\n");
}

export function contentWordCount(content: CityPageContent): number {
  return countWords(contentText(content));
}

/** Validate + normalize a model reply into CityPageContent. Throws CityContentError (retryable) on bad output. */
export function parseCityPageReply(
  raw: unknown,
  settings: CityPromptSettings,
  city: CityPromptCity,
  opts: { minWordsRatio?: number } = {}
): CityPageContent {
  const data = (typeof raw === "string" ? extractJsonObject(raw) : raw) as Record<string, unknown>;
  if (!data || typeof data !== "object") throw new CityContentError("bad_json", "Model reply was not an object.");
  const sections = (Array.isArray(data.sections) ? data.sections : [])
    .map((s) => ({ heading: str((s as Record<string, unknown>)?.heading, 160), body: str((s as Record<string, unknown>)?.body, 6000) }))
    .filter((s) => s.heading && s.body)
    .slice(0, 8);
  const faq = (Array.isArray(data.faq) ? data.faq : [])
    .map((f) => ({ question: str((f as Record<string, unknown>)?.question, 300), answer: str((f as Record<string, unknown>)?.answer, 1500) }))
    .filter((f) => f.question && f.answer)
    .slice(0, 6);
  const content: CityPageContent = {
    title: pageTitleFor(settings, city),
    metaDescription: str(data.metaDescription ?? data.meta_description, 320),
    h1: str(data.h1, 160),
    heroSubhead: str(data.heroSubhead, 400),
    intro: str(data.intro, 2000),
    sections,
    localHighlights: (Array.isArray(data.localHighlights) ? data.localHighlights : [])
      .map((h) => str(h, 300))
      .filter(Boolean)
      .slice(0, 6),
    faq: settings.includeFaq ? faq : [],
    ctaHeadline: str(data.ctaHeadline, 160),
    ctaText: str(data.ctaText, 600),
  };
  if (!content.h1) content.h1 = content.title;
  if (content.metaDescription.length > 160) content.metaDescription = `${content.metaDescription.slice(0, 157).replace(/\s+\S*$/, "")}...`;
  const problems: string[] = [];
  if (sections.length < 3) problems.push(`only ${sections.length} sections`);
  if (!content.metaDescription) problems.push("no meta description");
  if (!content.intro) problems.push("no intro");
  const words = contentWordCount(content);
  const minWords = Math.round(clampTargetWords(settings.targetWordCount) * (opts.minWordsRatio ?? 0.5));
  if (words < minWords) problems.push(`${words} words (< ${minWords})`);
  const all = contentText(content);
  if (/\{(city|state|keyword)\}/i.test(all)) problems.push("unfilled placeholder");
  if (!new RegExp(city.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(all)) problems.push("city name never mentioned");
  if (problems.length) throw new CityContentError("weak_output", `Rejected model output: ${problems.join(", ")}.`);
  return content;
}

/* ------------------------- operator editing format ------------------------- */

/** Sections <-> "## Heading\nbody" text for the review editor. */
export function sectionsToText(sections: CityPageSection[]): string {
  return sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
}

export function textToSections(text: string): CityPageSection[] {
  const out: CityPageSection[] = [];
  let current: CityPageSection | null = null;
  for (const line of String(text || "").replace(/\r/g, "").split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current) out.push(current);
      current = { heading: m[1].trim(), body: "" };
    } else if (current) current.body += `${line}\n`;
  }
  if (current) out.push(current);
  return out.map((s) => ({ heading: s.heading, body: s.body.trim() })).filter((s) => s.heading && s.body);
}

export function faqToText(faq: CityPageFaq[]): string {
  return faq.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
}

export function textToFaq(text: string): CityPageFaq[] {
  const out: CityPageFaq[] = [];
  for (const block of String(text || "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const q = block.match(/^Q:\s*([\s\S]+?)\nA:\s*([\s\S]+)$/m);
    if (q) out.push({ question: q[1].trim(), answer: q[2].trim() });
  }
  return out;
}

export function linesToList(text: string): string[] {
  return String(text || "")
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}
