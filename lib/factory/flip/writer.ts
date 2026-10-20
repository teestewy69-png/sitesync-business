/**
 * Flip content writer: the factory (not a person) writes guide + calculator page copy through the configured
 * LLM (local Ollama via LLM_BASE_URL/LLM_MODEL, hosted keys as fallback). Every page is length-checked
 * (900-1,500 words) and leak-checked, with up to two repair passes. Output is a draft pending approval.
 */
import { chatCompletion, resolveLlmProvider, type ChatMessage } from "@/lib/city-launch/llm";
import { checkContentLength, type ContentLengthCheck } from "../content-length";
import type { FlipState, PlannedPage } from "./model";
import type { CityPageContent } from "@/lib/city-launch/prompts";
import { flipPresetFor } from "./presets";

export type GeneratedPage = {
  slug: string;
  path: string;
  kind: "guide" | "calculator" | "city";
  title: string;
  body: string;
  words: number;
  check: ContentLengthCheck;
  leaks: string[];
  model: string;
  generatedAt: string;
  attempts: number;
  status: "pending_approval" | "needs_fix";
  approvedAt?: string;
  approvedBy?: string;
};

/** Text that must never appear on a flip site: old NBA/props product, PropCheck name, Sitesinc agency details. */
const LEAK_PATTERNS: [RegExp, string][] = [
  [/\bNBA\b/i, "NBA"],
  [/\bplayer props?\b|\bprop bets?\b|\bprops\b/i, "props"],
  [/propcheck/i, "PropCheck"],
  [/sitesinc|sitesync/i, "Sitesinc"],
  [/save@|\$1,995|1995 flat/i, "Sitesinc offer"],
  [/sportsbook|parlay|betting/i, "betting"],
];

export function contentLeaks(text: string): string[] {
  return LEAK_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
}

function systemPrompt(state: FlipState): string {
  const preset = flipPresetFor(state.niche);
  return [
    `You write web pages for ${state.businessName} (${state.domain}), a free tools and guides site for ${preset.audience}.`,
    "Write in plain, practical American English for beginners and small investors. Markdown only: one H1, H2/H3 sections, short paragraphs, bullet lists where useful, a short FAQ at the end.",
    "Do NOT invent statistics, prices, dates, lender rates or quotes. When a number illustrates a method, label it 'Example:' and keep it clearly hypothetical.",
    "Not financial, legal or tax advice: say so once near the end. No guarantees of profit.",
    "Never mention sports, NBA, props, betting, PropCheck, Sitesinc, or any web agency. Do not mention AI.",
    "Output ONLY the page markdown. No preamble, no notes.",
  ].join("\n");
}

function userPrompt(state: FlipState, page: PlannedPage, min: number, max: number): string {
  const calc = flipPresetFor(state.niche).calculators.find((c) => c.slug === page.slug);
  const what = page.kind === "city"
    ? `a city flip-market page titled "${page.title}" (path ${page.path}) for people considering flipping houses there. Cover: how to research the local market (public sources such as Zillow Research, FHFA HPI, Census, county records, local MLS via an agent), how to evaluate neighborhoods, typical rehab considerations for the area's housing stock in general terms, financing options (hard money, private money), permits and local rules to check with the city/county, and a step-by-step first-flip checklist. Do not state specific local prices, rents, days-on-market or growth numbers; tell the reader where to look them up. Link to the site's calculators as [ARV Calculator](/tools/arv-calculator) and [70% Rule Calculator](/tools/70-percent-rule-calculator).`
    : calc
    ? `the explainer copy for the "${calc.title}" calculator page (path ${page.path}). Inputs: ${calc.inputs.join(", ")}. Formula: ${calc.formula}. Explain what it calculates, each input, how to read the result, a worked Example with hypothetical numbers, common mistakes, and when to talk to a lender.`
    : `a guide titled "${page.title}" (path ${page.path}). Include where relevant a link suggestion to one of the site's calculators written as [Calculator name](/tools/slug).`;
  return `Write ${what}\nLength: between ${min} and ${max} words (aim for about ${Math.round((min + max) / 2)}). Count carefully.`;
}

export async function generateFlipPage(
  state: FlipState,
  page: PlannedPage,
  opts: { env?: Record<string, string | undefined>; fetchImpl?: unknown; timeoutMs?: number } = {}
): Promise<GeneratedPage> {
  const resolved = resolveLlmProvider(opts.env || process.env);
  if (!resolved) throw new Error("No LLM configured (set LLM_BASE_URL + LLM_MODEL for Ollama, or a hosted key).");
  const { min, max } = state.contentTarget;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(state) },
    { role: "user", content: userPrompt(state, page, min, max) },
  ];
  let body = "";
  let model = resolved.provider.model;
  let attempts = 0;
  for (; attempts < 3; ) {
    attempts += 1;
    const reply = await chatCompletion(resolved, messages, {
      fetchImpl: opts.fetchImpl as never,
      timeoutMs: opts.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS || 900_000),
      temperature: 0.6,
      maxTokens: 6000,
      appName: "Sitesinc Factory",
    });
    body = reply.content.replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
    model = reply.model;
    const check = checkContentLength(body, state.contentTarget);
    const leaks = contentLeaks(body);
    if (check.status === "ok" && !leaks.length) break;
    if (attempts >= 3) break;
    const fix = [
      check.status === "too_short" ? `It is ${check.words} words; expand it to between ${min} and ${max} words with more practical detail (no filler).` : "",
      check.status === "too_long" ? `It is ${check.words} words; tighten it to between ${min} and ${max} words.` : "",
      leaks.length ? `Remove every mention of: ${leaks.join(", ")}.` : "",
    ].filter(Boolean).join(" ");
    messages.push({ role: "assistant", content: body }, { role: "user", content: `${fix} Output the full revised page markdown only.` });
  }
  const check = checkContentLength(body, state.contentTarget);
  const leaks = contentLeaks(body);
  return {
    slug: page.slug, path: page.path, kind: page.kind === "calculator" ? "calculator" : page.kind === "city" ? "city" : "guide",
    title: page.title, body, words: check.words, check, leaks, model, generatedAt: new Date().toISOString(), attempts,
    status: check.status === "ok" && !leaks.length ? "pending_approval" : "needs_fix",
  };
}

/** Validate an imported page (e.g. generated on Tony's PC) with the same rules; never trusts the sender's verdict. */
export function revalidateGenerated(state: FlipState, page: GeneratedPage): GeneratedPage {
  const check = checkContentLength(page.body, state.contentTarget);
  const leaks = contentLeaks(`${page.title}\n${page.body}`);
  return { ...page, words: check.words, check, leaks, status: check.status === "ok" && !leaks.length ? "pending_approval" : "needs_fix" };
}

/** Render a City Launch draft (structured content) to markdown so it is checked like every other flip page. */
export function cityDraftToMarkdown(c: CityPageContent): string {
  const out = [`# ${c.h1 || c.title}`, c.heroSubhead, c.intro];
  for (const s of c.sections || []) {
    const sec = s as unknown as { heading?: string; body?: string; bullets?: string[] };
    out.push(`## ${sec.heading || ""}`, sec.body || "", ...(sec.bullets || []).map((b) => `- ${b}`));
  }
  if (c.serviceArea) out.push(c.serviceArea);
  if (c.localHighlights?.length) out.push("## Local highlights", ...c.localHighlights.map((h) => `- ${h}`));
  if (c.faq?.length) {
    out.push("## FAQ");
    for (const f of c.faq) {
      const q = f as unknown as { q?: string; question?: string; a?: string; answer?: string };
      out.push(`### ${q.q || q.question || ""}`, q.a || q.answer || "");
    }
  }
  out.push(`## ${c.ctaHeadline}`, c.ctaText);
  return out.filter((x) => x !== undefined && x !== "").join("\n\n");
}
