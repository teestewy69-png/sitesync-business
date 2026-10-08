/**
 * Client deliverable preview model (pure). Built only from the client's own config.
 * Never invents prices, testimonials, reviews, ratings, "booked jobs" claims or Sitesinc branding.
 * Anything the client still has to supply is shown as a clearly bracketed placeholder.
 */
import type { ClientBuildConfig } from "./client-config";
import {
  assetByRole,
  clientAssetUrl,
  copyExcerpt,
  isOperatorCopy,
  previewWorks,
  type PreviewWork,
} from "./client-content";
import { getClientTemplate, plannedPagePurpose } from "./client-templates";
import type { ClientContent, FactoryPage } from "./types";

export type ClientPreviewSection = {
  slug: string;
  title: string;
  text: string;
  /** True when the text is a "[client to supply]" placeholder rather than client facts. */
  placeholder: boolean;
};

export type ClientPreviewModel = {
  templateId: string;
  businessName: string;
  tagline: string;
  location: string;
  cta: { label: string; href: string } | null;
  contactLines: string[];
  /** Client-provided pricing note, or "" (no price is shown at all). */
  pricingNote: string;
  sections: ClientPreviewSection[];
  /** Excerpt of operator-supplied home copy, or "". */
  intro: string;
  /** Supplied works for the home "Selected work" grid (featured first), [] when none are supplied. */
  selectedWorks: PreviewWork[];
  /** Total supplied works (the grid shows at most a few). */
  workCount: number;
  heroImage: { src: string; alt: string } | null;
  artistPhoto: { src: string; alt: string } | null;
  logo: { src: string; alt: string } | null;
};

/** Client-supplied content the preview shows before any placeholder. All optional. */
export type ClientPreviewSupplied = {
  projectId: string;
  content?: ClientContent | null;
  pages?: Pick<FactoryPage, "slug" | "body" | "source">[];
};

export const HOME_SELECTED_WORKS = 6;

const PORTFOLIO_SECTIONS: Record<string, { title: string; text: string; placeholder: boolean }> = {
  portfolio: {
    title: "Selected work",
    text: "[Client to supply: images of the work with title, medium, size, year and availability.]",
    placeholder: true,
  },
  about: {
    title: "About",
    text: "[Client to supply: artist bio in their own words.]",
    placeholder: true,
  },
  exhibitions: {
    title: "Exhibitions",
    text: "[Confirmed shows only: year, title, venue, city. Left empty until the client confirms them.]",
    placeholder: true,
  },
};

function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

export function buildClientPreviewModel(config: ClientBuildConfig, supplied?: ClientPreviewSupplied): ClientPreviewModel {
  const template = getClientTemplate(config.templateId);
  const operatorPages = new Map(
    (supplied?.pages || []).filter((p) => isOperatorCopy(p) && p.body?.trim()).map((p) => [p.slug, p.body])
  );
  const copyFor = (slug: string) => {
    const body = operatorPages.get(slug);
    return body ? copyExcerpt(body) : "";
  };
  const allWorks = supplied ? previewWorks(supplied.projectId, supplied.content, config.pricingNote) : [];
  const imageOf = (role: "artist-photo" | "logo") => {
    const asset = supplied ? assetByRole(supplied.content, role) : null;
    return asset && supplied ? { src: clientAssetUrl(supplied.projectId, asset.filename), alt: asset.alt } : null;
  };
  const portfolio = template.id === "portfolio";
  const location = [config.city, config.state].filter(Boolean).join(", ");
  const offer = config.offer || config.niche || "";
  const tagline = offer
    ? portfolio
      ? `${offer}${location ? ` · ${location}` : ""}`
      : `${offer}${location ? ` in ${location}` : ""}`
    : location;

  const contactLines = [
    config.email ? `Email: ${config.email}` : "",
    config.phone ? `Phone: ${config.phone}` : "",
    location ? `${portfolio ? "Based in" : "Serving"} ${location}` : "",
  ].filter(Boolean);
  if (!config.email && !config.phone) contactLines.push("[Contact details not provided yet.]");

  const cta = config.email
    ? { label: portfolio ? "Inquire about a work" : `Contact ${config.businessName}`, href: `mailto:${config.email}` }
    : config.phone
      ? { label: `Call ${config.phone}`, href: `tel:${config.phone.replace(/[^\d+]/g, "")}` }
      : null;

  const sections: ClientPreviewSection[] = template.pages
    .filter((page) => page.slug !== "home")
    .map((page) => {
      const copy = copyFor(page.slug);
      if (portfolio && page.slug === "portfolio" && allWorks.length) {
        const series = [...new Set(allWorks.map((w) => w.series).filter(Boolean))];
        return {
          slug: page.slug,
          title: "Selected work",
          text: [copy, `${allWorks.length} work${allWorks.length === 1 ? "" : "s"}${series.length ? ` · series: ${series.join(", ")}` : ""}.`]
            .filter(Boolean)
            .join(" "),
          placeholder: false,
        };
      }
      if (copy) {
        const base = portfolio && PORTFOLIO_SECTIONS[page.slug] ? PORTFOLIO_SECTIONS[page.slug].title : page.slug === "contact" ? (portfolio ? "Inquiries" : "Contact") : page.title;
        return { slug: page.slug, title: base, text: copy, placeholder: false };
      }
      if (portfolio && PORTFOLIO_SECTIONS[page.slug]) {
        return { slug: page.slug, ...PORTFOLIO_SECTIONS[page.slug] };
      }
      if (page.slug === "contact") {
        return {
          slug: page.slug,
          title: portfolio ? "Inquiries" : "Contact",
          text: [
            portfolio
              ? `Questions about ${config.businessName}'s work go straight to ${config.email || "[client email]"}.`
              : `Reach ${config.businessName}${config.phone ? ` at ${config.phone}` : ""}${config.email ? ` or ${config.email}` : ""}.`,
            config.pricingNote ? `Pricing: ${config.pricingNote}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          placeholder: !config.email && !config.phone,
        };
      }
      if (page.slug === "services") {
        return {
          slug: page.slug,
          title: "Services",
          text: offer
            ? `${config.businessName} offers ${lowerFirst(offer)}. [Client to confirm the service list.]`
            : "[Client to supply: the service list in plain language.]",
          placeholder: !offer,
        };
      }
      if (page.slug === "about") {
        return {
          slug: page.slug,
          title: "About",
          text: `[Client to supply: who ${config.businessName} is, in their own words.]`,
          placeholder: true,
        };
      }
      return {
        slug: page.slug,
        title: page.title,
        text: `[${plannedPagePurpose(template.id, page)} Client to supply the details.]`,
        placeholder: true,
      };
    });

  return {
    templateId: template.id,
    businessName: config.businessName,
    tagline,
    location,
    cta,
    contactLines,
    pricingNote: config.pricingNote,
    sections,
    intro: copyFor("home"),
    selectedWorks: portfolio ? allWorks.slice(0, HOME_SELECTED_WORKS) : [],
    workCount: portfolio ? allWorks.length : 0,
    heroImage: portfolio ? allWorks.find((w) => w.image)?.image || null : null,
    artistPhoto: imageOf("artist-photo"),
    logo: imageOf("logo"),
  };
}

/** Phrases that must never appear in a client preview (invented proof / prices / Sitesinc chrome). */
export const FORBIDDEN_CLIENT_PREVIEW_PATTERNS: RegExp[] = [
  /\$\s?\d/,
  /\bfrom \$|\bfree estimate\b/i,
  /\btestimonial|\breviews?\b|★|\b\d(\.\d)? stars?\b/i,
  /booked jobs|book the crew|booking effortless|hired them/i,
  /live at sitesinc\.co|sitesinc\.co/i,
  /\b(Alex M\.|Sam T\.|Riley C\.)/,
  /trusted locally|satisfaction focused|transparent pricing/i,
];

/** Returns the first forbidden phrase found in client preview text, or null. */
export function findForbiddenPreviewClaim(text: string): string | null {
  for (const pattern of FORBIDDEN_CLIENT_PREVIEW_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}
