/**
 * Honest local listings / backlink checklist, generated per client from their config.
 *
 * Every item is a real place a local business can list itself, using its own real details.
 * Not included on purpose: link networks, link swaps, paid links, PBNs, review buying, fake listings,
 * fake addresses or virtual offices. Paid memberships (Chamber, BBB accreditation, trade groups) are
 * marked as optional and only worth it if the owner wants the membership itself, not "for SEO".
 */
import type { ClientBuildConfig } from "./client-config";

export type ListingItem = {
  id: string;
  name: string;
  /** Official sign-up / claim page (or a search hint when it is local and we can't know the URL). */
  url: string;
  /** What to do, in plain words. */
  action: string;
  /** Why it is worth doing. */
  why: string;
  cost: "free" | "free listing (paid extras optional)" | "membership (paid, optional)";
  /** Only applies in some cases (operator decides). */
  conditional?: string;
};

export type ListingChecklist = {
  businessName: string;
  /** The exact name / phone / address / website to use everywhere (NAP). */
  nap: { name: string; phone: string; address: string; website: string };
  items: ListingItem[];
  rules: string[];
};

const RULES = [
  "Use the exact same business name, phone and address everywhere (copy the NAP block). Mismatches confuse customers and maps.",
  "Only real details: no fake addresses, virtual offices, P.O. boxes passed off as a shop, or keyword-stuffed business names.",
  "Service-area businesses that don't see customers at their address should hide the address on Google and Bing and list service areas instead.",
  "Never buy links, join link networks or do link swaps. Never buy, swap or gate reviews.",
  "Ask happy customers for reviews in plain words; don't offer discounts or gifts for them.",
  "Listing doesn't guarantee a ranking or a number of calls. It makes the business easier to find and check.",
];

type TradeAssoc = { re: RegExp; name: string; url: string };

/** National trade groups with real member directories. Membership is paid and optional. */
const TRADE_ASSOCIATIONS: TradeAssoc[] = [
  { re: /plumb/i, name: "PHCC (Plumbing-Heating-Cooling Contractors Association) or your local chapter", url: "https://www.phccweb.org/" },
  { re: /hvac|heating|air cond|\bac\b/i, name: "ACCA (Air Conditioning Contractors of America) or your local chapter", url: "https://www.acca.org/" },
  { re: /electric/i, name: "NECA or IEC chapter for electrical contractors", url: "https://www.necanet.org/" },
  { re: /roof/i, name: "NRCA (National Roofing Contractors Association) or your state roofing association", url: "https://www.nrca.net/" },
  { re: /landscap|lawn|tree/i, name: "NALP (National Association of Landscape Professionals) or your state landscape association", url: "https://www.landscapeprofessionals.org/" },
  { re: /remodel|contractor|construction|handyman/i, name: "NARI (National Association of the Remodeling Industry) or your local builders association", url: "https://www.nari.org/" },
  { re: /pest/i, name: "NPMA (National Pest Management Association) or your state pest control association", url: "https://www.npmapestworld.org/" },
  { re: /paint/i, name: "PCA (Painting Contractors Association)", url: "https://www.pcapainted.org/" },
];

function tradeAssociation(niche: string): TradeAssoc | null {
  return TRADE_ASSOCIATIONS.find((t) => t.re.test(niche)) || null;
}

/** Per-client checklist. Pure: no network, no invented URLs for local groups (a search hint instead). */
export function localListingChecklist(
  config: Pick<ClientBuildConfig, "businessName" | "niche" | "city" | "state" | "phone" | "domain">,
  opts: { website?: string; address?: string } = {}
): ListingChecklist {
  const name = config.businessName;
  const where = [config.city, config.state].filter(Boolean).join(", ");
  const niche = config.niche || "your trade";
  const website = opts.website || (config.domain ? `https://${config.domain}` : "");
  const trade = tradeAssociation(niche);

  const items: ListingItem[] = [
    {
      id: "google-business-profile",
      name: "Google Business Profile",
      url: "https://www.google.com/business/",
      action: "Claim or create the profile, verify it, pick the main category, add service areas, hours, real photos and the website link.",
      why: "It's what shows on Google Maps and the map box in search. The single most important local listing.",
      cost: "free",
    },
    {
      id: "bing-places",
      name: "Bing Places for Business",
      url: "https://www.bingplaces.com/",
      action: "Claim the listing (it can import straight from Google Business Profile once that's verified).",
      why: "Covers Bing, Yahoo and DuckDuckGo maps, and some voice assistants.",
      cost: "free",
    },
    {
      id: "apple-business-connect",
      name: "Apple Business Connect",
      url: "https://businessconnect.apple.com/",
      action: "Claim the place card for Apple Maps and Siri; add hours, phone, photos and the website.",
      why: "iPhone users searching Apple Maps or asking Siri see this card.",
      cost: "free",
    },
    {
      id: "yelp",
      name: "Yelp for Business",
      url: "https://biz.yelp.com/",
      action: "Claim the free page and fill in services, service area and photos. Ignore the paid ad upsell unless the owner wants ads.",
      why: "Yelp pages rank for many local searches and feed other apps' business data.",
      cost: "free listing (paid extras optional)",
    },
    {
      id: "bbb",
      name: "Better Business Bureau (BBB)",
      url: "https://www.bbb.org/",
      action: "Check for an existing BBB profile and make sure the name, phone and address are correct. Accreditation is optional.",
      why: "Many customers check BBB before hiring a contractor.",
      cost: "free listing (paid extras optional)",
    },
    {
      id: "nextdoor",
      name: "Nextdoor business page",
      url: "https://business.nextdoor.com/",
      action: "Claim the free business page so neighbors can recommend the business by name.",
      why: "Neighbor recommendations are how a lot of local service work gets found.",
      cost: "free",
    },
    {
      id: "chamber",
      name: `${config.city ? `${config.city} ` : "Local "}Chamber of Commerce`,
      url: `Search: "${config.city || "your city"} Chamber of Commerce member directory"`,
      action: "If the owner wants to join, the member directory lists the business with a link to the site.",
      why: "A real local link and local referrals. Only worth it if the owner values the membership itself.",
      cost: "membership (paid, optional)",
    },
    {
      id: "trade-association",
      name: trade ? trade.name : `A trade association for ${niche}`,
      url: trade ? trade.url : `Search: "${[niche, "association", config.state, "member directory"].filter(Boolean).join(" ")}"`,
      action: "If the owner is (or wants to be) a member, ask to be listed in the member / find-a-pro directory.",
      why: "A trusted link from the trade itself, and proof of membership customers can check.",
      cost: "membership (paid, optional)",
      conditional: "Only if the owner is actually a member.",
    },
    {
      id: "supplier-dealer",
      name: "Supplier / manufacturer dealer or installer listings",
      url: "Ask the owner which brands they're certified, authorized or a dealer for, then find that brand's dealer/installer locator.",
      action: "Ask each brand to list the business in its dealer or certified-installer locator, with the website link.",
      why: "Customers shopping a brand find installers there, and it's a real link from the manufacturer.",
      cost: "free",
      conditional: "Only for brands the owner really holds a certification or dealer status with.",
    },
  ];

  return {
    businessName: name,
    nap: {
      name,
      phone: config.phone || "[phone missing: add it to the client config]",
      address:
        opts.address ||
        (where ? `${where} (confirm the full street address with the owner, or hide it if they don't see customers there)` : "[address / service area missing]"),
      website: website || "[website not live yet: add the URL once the site is published]",
    },
    items,
    rules: RULES,
  };
}

/** Copy-paste / download version for the owner or operator. */
export function listingChecklistText(list: ListingChecklist): string {
  const lines = [
    `Local listings checklist: ${list.businessName}`,
    "",
    "Use these exact details everywhere:",
    `  Name:    ${list.nap.name}`,
    `  Phone:   ${list.nap.phone}`,
    `  Address: ${list.nap.address}`,
    `  Website: ${list.nap.website}`,
    "",
    ...list.items.flatMap((item, i) => [
      `[ ] ${i + 1}. ${item.name} (${item.cost})`,
      `    Where: ${item.url}`,
      `    Do: ${item.action}`,
      `    Why: ${item.why}`,
      ...(item.conditional ? [`    Note: ${item.conditional}`] : []),
      "",
    ]),
    "Rules:",
    ...list.rules.map((r) => `- ${r}`),
  ];
  return lines.join("\n");
}
