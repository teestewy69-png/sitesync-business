import type { ContentBrief, FactoryPage } from "./types";
import type { ClientBuildConfig } from "./client-config";
import { artworkCaption, orderedArtworks, type SuppliedContent } from "./client-content";
import type { ClientArtwork } from "./types";
import { clientFacingEmail } from "./client-real-site";

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

  const email = clientFacingEmail(config.email);
  const contactBits = [email ? `email ${email}` : "", config.phone ? `call ${config.phone}` : ""].filter(Boolean);
  const contactLine = contactBits.length
    ? `To get in touch, ${contactBits.join(" or ")}${portfolio ? "" : ", or use the contact form"}.`
    : "[Contact details not provided yet - add an email or phone before review.]";
  const pricingLine = config.pricingNote ? `Pricing: ${config.pricingNote}.` : "";
  const needsLocation = config.templateId === "local-service";
  const locationLine = loc
    ? portfolio
      ? `Based in ${loc}.`
      : `Serving ${loc}. Other cities only through City Launch (unique local copy per city; near-duplicates are blocked by the quality gate).`
    : needsLocation
      ? MISSING_LOCATION
      : "";

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
    : fullClientSections(brief.slug, headings, { config, offer, niche, loc, contactLine, pricingLine, locationLine });

  const body = [
    intro,
    "This page is a factory draft seeded from intake. Replace bracketed notes with the client's real facts, photos and wording before approval.",
    "",
    ...sections.flatMap(([heading, lines]) => [`## ${heading}`, "", ...lines.filter(Boolean), ""]),
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

type SectionCtx = { config: ClientBuildConfig; offer: string; niche: string; loc: string; contactLine: string; pricingLine: string; locationLine: string };

/**
 * Full-page client draft sections (target 900-1500 words for content pages) built only from intake facts.
 * Unknown facts stay as [bracketed] operator notes; never invents prices, reviews, phones or addresses.
 */
export function fullClientSections(slug: string, headings: string[], c: SectionCtx): [string, string[]][] {
  const { config, offer, niche, loc, contactLine, pricingLine, locationLine } = c;
  const name = config.businessName;
  const where = loc ? ` in ${loc}` : "";
  const goal = lowerFirst(config.primaryGoal || "get more calls and leads");
  const price = pricingLine || "[Pricing: client to confirm what to publish (exact price, from-price, or 'quote on request').]";
  const process: [string, string[]] = ["How it works", [
    `1. Get in touch. ${contactLine}`,
    `2. Talk it through. ${name} asks what you need, what you have now, and what a good result looks like for you, then explains the options in plain language.`,
    `3. Clear scope and price. Before any work starts you get the scope in writing${pricingLine ? " and the price shown on this page" : ""}, so there are no surprises later.`,
    `4. The work gets done. ${name} handles the ${niche} work and keeps you updated at each step, with a clear point of contact.`,
    `5. Follow-up. After the job, ${name} checks that everything works the way you expected and answers any questions.`,
  ]];
  const faq: [string, string[]] = ["Frequently asked questions", [
    `**What does ${name} do?** ${name} provides ${lowerFirst(offer)}${where}. The focus is doing the core work well rather than upselling extras you do not need.`,
    `**How much does it cost?** ${pricingLine || "[Client to confirm the pricing answer before review.]"}`,
    `**Where do you work?** ${locationLine || "[Client to list the cities / service area.]"}`,
    `**How do I get started?** ${contactLine}`,
    `**How long does it take?** [Client to give a typical timeline; do not publish a promise the client has not confirmed.]`,
    `**What do I need to have ready?** A short description of what you need, any examples you like, and the best way to reach you. ${name} will ask for anything else.`,
  ]];
  const why: [string, string[]] = [`Why people choose ${name}`, [
    `People looking for ${niche}${where} usually want three things: a straight answer on price, someone who shows up and communicates, and work that holds up. ${name} is built around those three.`,
    `Every claim on this page comes from ${name}'s own intake details. Reviews, awards, licenses and photos are added only when the client provides real ones. [Client: add real reviews / photos / credentials here.]`,
    `The goal of this site is simple: ${goal}. Each page points to one next step so visitors are never left guessing what to do.`,
  ]];
  const cta: [string, string[]] = [headings[2] || "Ready to get started?", [
    `${name} makes it easy to take the next step. ${contactLine}`,
    price,
  ]];
  const area: [string, string[]] = [loc ? `Serving ${loc}` : "Service area", [
    locationLine || "[Client to list the service area.]",
    `Local search works best when the page says plainly where the business works. ${name} lists only areas it actually serves; extra city pages are created only through City Launch with unique local copy.`,
  ]];
  if (slug === "contact") {
    return [
      [headings[0] || `Contact ${name}`, [contactLine, `${name} replies as quickly as possible during business hours. [Client to confirm hours.]`]],
      area,
      ["What to include in your message", ["A short description of what you need, your timeline, and the best way to reach you. The more detail you give, the more accurate the first answer will be."]],
      faq,
    ];
  }
  if (slug === "about") {
    return [
      [headings[0] || `About ${name}`, [`${name} provides ${lowerFirst(offer)}${where}. [Client to add the owner's story: who runs it, how long, and why.]`, `The way ${name} works is straightforward: clear pricing, plain-language communication, and doing the job right the first time.`]],
      why, process, area, cta,
    ];
  }
  if (slug === "services") {
    return [
      [headings[0] || `What ${name} offers`, [`${name} offers ${lowerFirst(offer)}${where}.`, `[Client to list each service with one or two sentences on what is included.]`, price]],
      ["What is included", [`Every ${niche} job from ${name} includes a clear written scope, a single point of contact, and a check at the end to make sure the result matches what was agreed. [Client to confirm inclusions.]`]],
      process, why, area, faq, cta,
    ];
  }
  return [
    [headings[0] || `What ${name} offers`, [`${name} focuses on ${lowerFirst(offer)}${where}. Goal for this site: ${goal}.`, price]],
    [headings[1] || "Who this is for", [locationLine || "[Client to describe who uses this and why, in their own words.]", `It is for people${where} who want ${niche} done properly, explained clearly, and priced upfront.`]],
    why, process, area, faq, cta,
  ];
}

export function wordCount(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}
