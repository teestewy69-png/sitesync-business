import type { ContentBrief, FactoryPage } from "./types";
import type { ClientBuildConfig } from "./client-config";

type Draft = Pick<FactoryPage, "title" | "metaDescription" | "headings" | "body">;

const PORTFOLIO_PAGE_NOTES: Record<string, string> = {
  home: "[Client to supply: 6-12 images of the work with title, medium, size and year.]",
  about: "[Client to supply: artist bio in their own words. No invented awards, press or collections.]",
  portfolio: "[Client to supply: images of the work with title, medium, size, year and availability.]",
  exhibitions: "[List confirmed shows only: year, title, venue, city. Leave this empty if none are confirmed.]",
  contact: "[Confirm how the client wants inquiries handled before launch.]",
};

function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

/**
 * Honest structured draft from client config + brief.
 * Not LLM research - templated copy the operator must edit with real client facts.
 * Never invents prices, reviews, testimonials, licenses or a location.
 */
export function draftFromClientBrief(
  brief: ContentBrief,
  config: ClientBuildConfig
): Draft {
  const loc = [config.city, config.state].filter(Boolean).join(", ");
  const niche = config.niche || "services";
  const offer = config.offer || niche;
  const portfolio = config.templateId === "portfolio";
  const headings =
    brief.headings.length > 0
      ? brief.headings
      : portfolio
        ? [`${config.businessName}`, "The work", "How to inquire"]
        : [`What ${config.businessName} offers`, loc ? `Who this helps in ${loc}` : "Who this helps", "How to get started"];

  const contactBits = [config.email ? `email ${config.email}` : "", config.phone ? `call ${config.phone}` : ""].filter(Boolean);
  const contactLine = contactBits.length
    ? `To get in touch, ${contactBits.join(" or ")}${portfolio ? "" : ", or use the contact form"}.`
    : "[Contact details not provided yet - add an email or phone before review.]";
  const pricingLine = config.pricingNote ? `Pricing: ${config.pricingNote}.` : "";
  const locationLine = loc
    ? portfolio
      ? `Based in ${loc}.`
      : `Serving ${loc}. Other cities only through City Launch (unique local copy per city; near-duplicates are blocked by the quality gate).`
    : "[Location not provided yet - add the client's city and state before review.]";

  const intro = portfolio
    ? `${config.businessName}: ${lowerFirst(offer)}${loc ? `, ${loc}` : ""}.`
    : `${config.businessName} offers ${lowerFirst(offer)}${loc ? ` in ${loc}` : ""}.`;

  const body = [
    intro,
    "This page is a factory draft seeded from intake. Replace bracketed notes with the client's real facts, photos and wording before approval.",
    "",
    `## ${headings[0]}`,
    "",
    portfolio
      ? `${config.businessName} makes ${lowerFirst(offer)}. Goal for this site: ${lowerFirst(config.primaryGoal)}.`
      : `${config.businessName} focuses on ${lowerFirst(offer)}. Goal for this site: ${lowerFirst(config.primaryGoal)}.`,
    portfolio ? PORTFOLIO_PAGE_NOTES[brief.slug] || "" : "",
    "",
    `## ${headings[1] || "Location"}`,
    "",
    locationLine,
    "",
    `## ${headings[2] || "How to get started"}`,
    "",
    contactLine,
    pricingLine,
    "",
    "## What this draft is not",
    "",
    "Not published anywhere. Prices, ratings and other claims appear only if the client provides them. Competitor analysis belongs on the brief's competitorUrls field (analyze top 3). Rankings are not guaranteed.",
    "",
    brief.competitorUrls.length
      ? `Competitor URLs on brief: ${brief.competitorUrls.join(", ")}`
      : "Competitor URLs: none attached yet - fill competitorUrls on the brief before treating research as done.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");

  const metaParts = [
    portfolio ? `${offer} by ${config.businessName}` : `${config.businessName} - ${offer}`,
    loc ? `${portfolio ? "Based in" : "in"} ${loc}.` : "",
    config.pricingNote ? `Pricing: ${config.pricingNote}.` : "",
  ].filter(Boolean);

  return {
    title: brief.title,
    metaDescription: metaParts.join(portfolio ? ". " : " ").replace(/\.\./g, ".").slice(0, 155),
    headings,
    body,
  };
}

export function wordCount(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}
