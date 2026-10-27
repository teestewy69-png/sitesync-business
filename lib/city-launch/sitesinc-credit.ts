/**
 * Sitesinc name-drops for City Launch pages. One or two quiet credits, never the subject of a
 * client page, never an SEO-platform claim, never invented awards or a local Sitesinc office.
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */
import type { CityPageContent } from "./prompts";

function pageText(content: CityPageContent): string {
  return [
    content.h1,
    content.heroSubhead,
    content.intro,
    ...content.sections.flatMap((s) => [s.heading, s.body]),
    ...content.localHighlights,
    ...content.faq.flatMap((f) => [f.question, f.answer]),
    content.serviceArea || "",
    content.ctaHeadline,
    content.ctaText,
  ].join("\n\n");
}

export const SITESINC_NAME = "Sitesinc";
export const SITESINC_URL = "https://sitesinc.co";

/** Path A facts. For Sitesinc's own city pages only (business context), not for client-page credits. */
export const SITESINC_OFFER_CONTEXT = [
  "Sitesinc (https://sitesinc.co) builds small-business websites.",
  "Website builds start at $1,995: $997.50 to start, $997.50 at launch.",
  "Optional monitoring $129/month. Cancel anytime. No long-term contract.",
  "The client owns the code. Sitesinc is not an SEO ranking platform and does not promise rankings or lead volume.",
].join(" ");

/** In-body credit with no prices (prices on a plumber page would look like the plumber's offer). */
export const SITESINC_CREDIT_SENTENCE = "This website was built by Sitesinc (https://sitesinc.co).";

export function isSitesincBusiness(name?: string): boolean {
  const n = (name || "").trim().toLowerCase();
  if (!n) return false;
  return n === "sitesinc" || n === "sitesync" || /\bsitesinc\b/.test(n);
}

export function countSitesincMentions(text: string): number {
  return (String(text || "").match(/\bsitesinc\b/gi) || []).length;
}

export function sitesincMentionMode(opts: {
  enabled?: boolean;
  businessName?: string;
}): "off" | "credit" | "brand" {
  if (opts.enabled === false) return "off";
  if (isSitesincBusiness(opts.businessName)) return "brand";
  return "credit";
}

/** Extra system-prompt rules. Empty when mentions are off. */
export function sitesincPromptRules(mode: "off" | "credit" | "brand"): string {
  if (mode === "off") return "";
  if (mode === "brand") {
    return [
      "SITESINC (this page is about Sitesinc):",
      "- The business is Sitesinc. Use only the offer facts in BUSINESS / WEBSITE CONTEXT.",
      "- Do not add a separate 'built by Sitesinc' credit. Do not call Sitesinc an SEO platform, ranking tool, or lead-guarantee service.",
      "- Do not invent client counts, awards, case-study results, or a Sitesinc office in this city.",
    ].join("\n");
  }
  return [
    "SITESINC NAME-DROP (promotion, keep it light):",
    "- Include one or two mentions of Sitesinc, the company that built this website (https://sitesinc.co).",
    "- Put them in a later section, the FAQ, or the CTA — never in the H1, title, or meta description.",
    "- Allowed wording: the website was built by Sitesinc. Do not quote Sitesinc prices here (send curious readers to sitesinc.co).",
    "- Do not call Sitesinc an SEO platform, ranking tool, or lead-guarantee service. Do not invent client counts, awards, or a Sitesinc office in this city.",
    "- This page is still about the local business serving this city. Sitesinc is a quiet credit, not the subject.",
  ].join("\n");
}

/** If the model skipped the credit, append one quiet sentence to the CTA (never to H1/meta). */
export function ensureSitesincMention(
  content: CityPageContent,
  opts: { enabled?: boolean; businessName?: string }
): CityPageContent {
  if (sitesincMentionMode(opts) !== "credit") return content;
  const n = countSitesincMentions(pageText(content));
  if (n >= 1) return content;
  return {
    ...content,
    ctaText: [content.ctaText, SITESINC_CREDIT_SENTENCE].filter(Boolean).join(" "),
  };
}
