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

const MISSING_LOCATION = "[Location not provided yet - add the client's city and state before review.]";

/**
 * Portfolio (artist) sections: each heading gets text that belongs under it. The location sits in a sentence
 * about the artist (or under the "Based in ..." heading on About) - never under "Available originals".
 */
function portfolioSections(
  slug: string,
  headings: string[],
  ctx: { config: ClientBuildConfig; offer: string; loc: string; contactLine: string; pricingLine: string }
): [string, string[]][] {
  const { config, offer, loc, contactLine, pricingLine } = ctx;
  const name = config.businessName;
  const goal = `Goal for this site: ${lowerFirst(config.primaryGoal)}.`;
  const makes = `${name} makes ${lowerFirst(offer)}${loc ? ` in ${loc}` : ""}.`;
  const h = (i: number, fallback: string) => headings[i] || fallback;
  const pricingOrNote = pricingLine || "[Pricing not provided - say how pricing is shared (e.g. on request) only once the client confirms it.]";
  switch (slug) {
    case "about":
      return [
        [h(0, `About ${name}`), [PORTFOLIO_PAGE_NOTES.about]],
        [h(1, "The work"), [`${name} makes ${lowerFirst(offer)}. ${goal}`, "[Client to supply: mediums, subjects and how the work is made.]"]],
        [h(2, "Based in"), [loc ? `${name} is based in ${loc}.` : MISSING_LOCATION, contactLine]],
      ];
    case "portfolio":
      return [
        [h(0, "Selected work"), [makes, PORTFOLIO_PAGE_NOTES.portfolio, loc ? "" : MISSING_LOCATION]],
        [
          h(1, "Available originals"),
          ["[Client to supply: which originals are currently available, with title, medium and size. Leave out sold work or mark it sold.]", pricingLine],
        ],
        [h(2, "How to inquire"), [contactLine]],
      ];
    case "exhibitions":
      return [
        [h(0, "Exhibitions"), [makes, PORTFOLIO_PAGE_NOTES.exhibitions, loc ? "" : MISSING_LOCATION]],
        [h(1, "Upcoming"), ["[Upcoming shows only once confirmed: dates, venue, city. Leave this empty if none are confirmed.]"]],
        [h(2, "Gallery and representation inquiries"), [contactLine]],
      ];
    case "contact":
      return [
        [h(0, `Contact ${name}`), [contactLine, loc ? `${name} is based in ${loc}.` : MISSING_LOCATION]],
        [h(1, "Inquiries"), [PORTFOLIO_PAGE_NOTES.contact]],
        [h(2, "Pricing and availability"), [pricingOrNote]],
      ];
    default:
      return [
        [h(0, name), [makes, goal, loc ? "" : MISSING_LOCATION]],
        [h(1, "The work"), [PORTFOLIO_PAGE_NOTES[slug] || PORTFOLIO_PAGE_NOTES.home]],
        [h(2, "How to inquire"), [contactLine, pricingLine]],
      ];
  }
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
    : MISSING_LOCATION;

  const intro = portfolio
    ? `${config.businessName}: ${lowerFirst(offer)}${loc ? `, ${loc}` : ""}.`
    : `${config.businessName} offers ${lowerFirst(offer)}${loc ? ` in ${loc}` : ""}.`;

  const sections: [string, string[]][] = portfolio
    ? portfolioSections(brief.slug, headings, {
        config,
        offer,
        loc,
        contactLine,
        pricingLine,
      })
    : [
        [
          headings[0],
          [`${config.businessName} focuses on ${lowerFirst(offer)}. Goal for this site: ${lowerFirst(config.primaryGoal)}.`],
        ],
        [headings[1] || "Location", [locationLine]],
        [headings[2] || "How to get started", [contactLine, pricingLine]],
      ];

  const body = [
    intro,
    "This page is a factory draft seeded from intake. Replace bracketed notes with the client's real facts, photos and wording before approval.",
    "",
    ...sections.flatMap(([heading, lines]) => [`## ${heading}`, "", ...lines.filter(Boolean), ""]),
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
