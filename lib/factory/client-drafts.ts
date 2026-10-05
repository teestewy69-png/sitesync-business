import type { ContentBrief, FactoryPage } from "./types";
import type { ClientBuildConfig } from "./client-config";

type Draft = Pick<FactoryPage, "title" | "metaDescription" | "headings" | "body">;

/**
 * Honest structured draft from client config + brief.
 * Not LLM research — templated copy the operator must edit with real client facts.
 */
export function draftFromClientBrief(
  brief: ContentBrief,
  config: ClientBuildConfig
): Draft {
  const loc = [config.city, config.state].filter(Boolean).join(", ") || "your area";
  const niche = config.niche || "services";
  const phone = config.phone || "your phone number";
  const headings =
    brief.headings.length > 0
      ? brief.headings
      : [
          `What ${config.businessName} offers`,
          `Who this helps in ${loc}`,
          "How to get started",
        ];

  const body = [
    `${config.businessName} is a ${niche} business serving ${loc}. This page is a factory draft seeded from intake — replace placeholder claims with real photos, prices, and licenses before publish.`,
    "",
    `## ${headings[0]}`,
    "",
    `${config.businessName} focuses on ${niche}. Primary goal from intake: ${config.primaryGoal || "clear next step for visitors"}.`,
    "",
    `## ${headings[1] || "Local context"}`,
    "",
    `Service area: ${loc}. Do not expand this into thin city doorway pages.`,
    "",
    `## ${headings[2] || "How to get started"}`,
    "",
    config.phone
      ? `Call ${phone} or use the contact form. Confirm hours and response times with the client before launch.`
      : "Add a phone number and contact form. Confirm hours with the client before launch.",
    "",
    "## What this draft is not",
    "",
    "This is not auto-published to Netlify. Competitor analysis belongs on the brief's competitorUrls field (analyze top 3). Rankings are not guaranteed.",
    "",
    brief.competitorUrls.length
      ? `Competitor URLs on brief: ${brief.competitorUrls.join(", ")}`
      : "Competitor URLs: none attached yet — fill competitorUrls on the brief before treating research as done.",
  ].join("\n");

  return {
    title: brief.title,
    metaDescription: `${config.businessName} — ${niche} in ${loc}. ${config.primaryGoal || "Get in touch."}`.slice(
      0,
      155
    ),
    headings,
    body,
  };
}

export function wordCount(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}
