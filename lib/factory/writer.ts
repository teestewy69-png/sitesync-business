/**
 * SitesInc page writer: the factory (not a person) writes the workspace content pages through the configured
 * LLM (hosted key such as OPENROUTER_API_KEY, or local Ollama via LLM_BASE_URL/LLM_MODEL). The writer is fed
 * the approved brief (intent, headings, outline, gaps, word window) plus live competitor research crawled
 * from the brief's competitorUrls, and writes against the approved SitesInc facts only. Every page is
 * length-checked and leak-checked, with up to two repair passes.
 *
 * Failure is LOUD by design: no provider, an auth/network error, an empty reply, or copy that still leaks
 * after repairs throws, so the caller leaves the existing page text untouched and surfaces the error.
 * This replaces the old template lookup (draftFromBrief), which silently re-applied fixed text.
 */
import {
  chatCompletion,
  resolveLlmProvider,
  LlmError,
  type ChatMessage,
} from "@/lib/city-launch/llm";
import { checkContentLength, type ContentLengthCheck } from "./content-length";
import { analyzeCompetitors, competitorPromptBlock } from "./flip/competitors";
import type { ContentBrief } from "./types";

export type WrittenPage = {
  slug: string;
  body: string;
  headings: string[];
  words: number;
  check: ContentLengthCheck;
  model: string;
  generatedAt: string;
  attempts: number;
};

/** Copy that must never reach a public SitesInc page: production labels, AI talk, stack jargon, retired offers. */
const LEAK_PATTERNS: [RegExp, string][] = [
  [/sitesinc factory|content brief|word[- ]count guidance/i, "production labels"],
  [/as an ai|language model/i, "AI self-reference"],
  [/next\.js|tailwind/i, "tech stack names"],
  [/auto[- ]?charge|card (is )?required/i, "unapproved monitoring billing language"],
  [/\$1,?495|\bpilot\b/i, "the retired $1,495 pilot"],
  [/lorem ipsum/i, "placeholder text"],
];

export function writtenPageLeaks(text: string): string[] {
  return LEAK_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
}

const FACTS = [
  "Approved facts — use them exactly; never change a number:",
  "- One price: $1,995 flat, one-time. $997.50 to start, $997.50 when the site is complete. No discounts, no fake scarcity, no strike-through prices, no \"starting at\".",
  "- The client owns the website and the domain. No lock-in, no contract.",
  "- Optional monitoring is $129/month, only for clients who choose it. The site keeps working without it. Never say a card is required and never say anything auto-charges.",
  "- Free website audit: visitors leave their website address and email; the audit is run and the results are emailed back with a free ebook. It is not instant.",
  "- Contact: call (909) 323-1575 or email save@sitesinc.co. Business address: 1968 South Coast Hwy #3632, Laguna Beach, CA 92651 (use only when an address belongs on the page).",
].join("\n");

function systemPrompt(): string {
  return [
    "You write web pages for SitesInc (sitesinc.co), a website design service for small businesses that do not have a website yet, or have one that is outdated. The business is SiteSync LLC; SitesInc is the brand.",
    "Write in plain, direct American English for busy small-business owners. Markdown only: H2/H3 sections (## and ###), short paragraphs, bullet lists where useful, and a short FAQ near the end when the brief's outline calls for one. No H1 — the page template adds it.",
    FACTS,
    "Never invent statistics, testimonials, reviews, client names, years in business, rankings, or results. Never name web frameworks, stacks, or tools. Never mention competitors by name, this brief, word counts, or that you are an AI.",
    "Output ONLY the page markdown. No preamble, no notes.",
  ].join("\n");
}

function userPrompt(brief: ContentBrief, target: number): string {
  const lines = [
    `Write the page "${brief.title}" (path /${brief.slug}).`,
    "",
    `Search intent: ${brief.searchIntent}`,
    "",
    "Use these section headings (you may add subsections where they help):",
    ...brief.headings.map((h) => `- ${h}`),
    "",
    "Follow this outline:",
    ...brief.outline.map((o, i) => `${i + 1}. ${o}`),
  ];
  if (brief.recurringTopics.length) {
    lines.push("", `Cover these recurring topics where they fit: ${brief.recurringTopics.join("; ")}.`);
  }
  if (brief.gaps.length) {
    lines.push("", "Fill these gaps the competition leaves open:", ...brief.gaps.map((g) => `- ${g}`));
  }
  lines.push(
    "",
    `Length: between ${brief.wordCountGuidance.min} and ${brief.wordCountGuidance.max} words (aim for about ${target}). Count carefully.`
  );
  return lines.join("\n");
}

function extractHeadings(body: string): string[] {
  return [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean).slice(0, 60);
}

export async function writeFromBrief(
  brief: ContentBrief,
  opts: {
    env?: Record<string, string | undefined>;
    fetchImpl?: unknown;
    competitorFetch?: unknown;
    timeoutMs?: number;
  } = {}
): Promise<WrittenPage> {
  const env = opts.env || process.env;
  const resolved = resolveLlmProvider(env);
  if (!resolved) {
    throw new LlmError(
      "missing_key",
      "No writing key configured. Set OPENROUTER_API_KEY (or another provider key) — the writer will not fake copy without one."
    );
  }
  const target = {
    min: brief.wordCountGuidance.min,
    max: brief.wordCountGuidance.max,
    target: Math.round((brief.wordCountGuidance.min + brief.wordCountGuidance.max) / 2),
  };
  const competitors = await analyzeCompetitors(brief.title, {
    env,
    fetchImpl: opts.competitorFetch as never,
    manualUrls: brief.competitorUrls,
    mode: "client",
    niche: "website design",
  });
  const research = competitorPromptBlock(competitors);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt(brief, target.target) },
  ];
  if (research) messages[1] = { role: "user", content: `${messages[1].content}\n\n${research}` };

  let body = "";
  let model = resolved.provider.model;
  let attempts = 0;
  for (; attempts < 3; ) {
    attempts += 1;
    const reply = await chatCompletion(resolved, messages, {
      fetchImpl: opts.fetchImpl as never,
      timeoutMs: opts.timeoutMs ?? 120_000,
      temperature: 0.6,
      maxTokens: 6000,
      appName: "Sitesinc Factory",
    });
    body = reply.content.replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
    model = reply.model;
    const check = checkContentLength(body, target);
    const leaks = writtenPageLeaks(body);
    if (body && check.status === "ok" && !leaks.length) break;
    if (attempts >= 3) break;
    const fix = [
      !body ? "Your reply was empty; write the full page." : "",
      check.status === "too_short"
        ? `It is ${check.words} words; expand it to between ${target.min} and ${target.max} words with more practical detail (no filler).`
        : "",
      check.status === "too_long"
        ? `It is ${check.words} words; tighten it to between ${target.min} and ${target.max} words.`
        : "",
      leaks.length ? `Remove every instance of: ${leaks.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    messages.push(
      { role: "assistant", content: body },
      { role: "user", content: `${fix} Output the full revised page markdown only.` }
    );
  }

  const leaks = writtenPageLeaks(body);
  if (!body) throw new LlmError("bad_response", "The writer returned an empty page; the existing page text was left untouched.");
  if (leaks.length) {
    throw new LlmError(
      "bad_response",
      `The writer produced copy containing ${leaks.join(", ")} after ${attempts} attempts; the existing page text was left untouched.`
    );
  }
  const check = checkContentLength(body, target);
  return {
    slug: brief.slug,
    body,
    headings: extractHeadings(body),
    words: check.words,
    check,
    model,
    generatedAt: new Date().toISOString(),
    attempts,
  };
}
