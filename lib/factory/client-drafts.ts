import type { ContentBrief, FactoryPage } from "./types";
import type { ClientBuildConfig } from "./client-config";
import { artworkCaption, orderedArtworks, type SuppliedContent } from "./client-content";
import type { ClientArtwork } from "./types";

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

/** "- Title (Series) — medium · size · year · availability" lines for supplied works. */
function workLines(works: ClientArtwork[], pricingNote: string, limit = 60): string[] {
  const lines = works.slice(0, limit).map((work) => {
    const caption = artworkCaption(work, pricingNote);
    const title = `${work.title || "Untitled"}${work.series ? ` (${work.series})` : ""}`;
    return `- ${title}${caption ? ` — ${caption}` : ""}`;
  });
  if (works.length > limit) lines.push(`- …and ${works.length - limit} more in the full list.`);
  return lines;
}

/** One honest bracketed note naming only the fields the client still has to confirm. */
function missingWorkFieldsNote(works: ClientArtwork[]): string {
  if (!works.length) return "";
  const missing = (
    [
      ["image", (w: ClientArtwork) => !w.imageId],
      ["medium", (w: ClientArtwork) => !w.medium],
      ["size", (w: ClientArtwork) => !w.size],
      ["year", (w: ClientArtwork) => !w.year],
      ["availability", (w: ClientArtwork) => !w.availability || w.availability === "unknown"],
    ] as Array<[string, (w: ClientArtwork) => boolean]>
  )
    .map(([label, test]) => [label, works.filter(test).length] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} for ${count === works.length ? "all" : count} of ${works.length} works`);
  return missing.length ? `[Client to confirm: ${missing.join("; ")}.]` : "";
}

function uniq(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))];
}

const MISSING_LOCATION = "[Location not provided yet - add the client's city and state before review.]";

/**
 * Portfolio (artist) sections: each heading gets text that belongs under it. The location sits in a sentence
 * about the artist (or under the "Based in ..." heading on About) - never under "Available originals".
 */
function portfolioSections(
  slug: string,
  headings: string[],
  ctx: {
    config: ClientBuildConfig;
    offer: string;
    loc: string;
    contactLine: string;
    pricingLine: string;
    supplied?: SuppliedContent;
  }
): [string, string[]][] {
  const { config, offer, loc, contactLine, pricingLine } = ctx;
  const works = orderedArtworks(ctx.supplied?.artworks || []);
  const available = works.filter((w) => w.availability === "available");
  const series = uniq(works.map((w) => w.series));
  const mediums = uniq(works.map((w) => w.medium));
  const name = config.businessName;
  const goal = `Goal for this site: ${lowerFirst(config.primaryGoal)}.`;
  const makes = `${name} makes ${lowerFirst(offer)}${loc ? ` in ${loc}` : ""}.`;
  const h = (i: number, fallback: string) => headings[i] || fallback;
  const pricingOrNote = pricingLine || "[Pricing not provided - say how pricing is shared (e.g. on request) only once the client confirms it.]";
  switch (slug) {
    case "about":
      return [
        [h(0, `About ${name}`), [PORTFOLIO_PAGE_NOTES.about]],
        [
          h(1, "The work"),
          [
            `${name} makes ${lowerFirst(offer)}. ${goal}`,
            series.length ? `Series: ${series.join(", ")}.` : "",
            mediums.length ? `Mediums: ${mediums.join("; ")}.` : "",
            mediums.length ? "" : "[Client to supply: mediums, subjects and how the work is made.]",
          ],
        ],
        [h(2, "Based in"), [loc ? `${name} is based in ${loc}.` : MISSING_LOCATION, contactLine]],
      ];
    case "portfolio":
      return [
        [
          h(0, "Selected work"),
          works.length
            ? [makes, ...workLines(works, config.pricingNote), "", missingWorkFieldsNote(works), loc ? "" : MISSING_LOCATION]
            : [makes, PORTFOLIO_PAGE_NOTES.portfolio, loc ? "" : MISSING_LOCATION],
        ],
        [
          h(1, "Available originals"),
          available.length
            ? [...workLines(available, config.pricingNote), "", pricingLine]
            : works.length
              ? ["[Client to confirm which of these originals are currently available.]", pricingLine]
              : ["[Client to supply: which originals are currently available, with title, medium and size. Leave out sold work or mark it sold.]", pricingLine],
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
        [
          h(1, "The work"),
          works.length
            ? workLines(works, config.pricingNote, 12)
            : [PORTFOLIO_PAGE_NOTES[slug] || PORTFOLIO_PAGE_NOTES.home],
        ],
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
  config: ClientBuildConfig,
  supplied?: SuppliedContent
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
        supplied,
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
