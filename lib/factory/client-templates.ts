import type { SeededClientPage } from "@/lib/store";

export type ClientTemplateId = "local-service" | "portfolio" | "general";

export type ClientTemplatePageDef = {
  slug: string;
  path: string;
  title: string;
  purpose: string;
  keywordPattern: string;
};

export type ClientTemplate = {
  id: ClientTemplateId;
  name: string;
  description: string;
  /** Demo seed this template reuses (fixture path, not live binding). */
  demoSeed: string;
  defaultDesignStyleId: string;
  pages: ClientTemplatePageDef[];
};

export const CLIENT_TEMPLATES: ClientTemplate[] = [
  {
    id: "local-service",
    name: "Local service (call-first)",
    description:
      "Home, services, emergency, contact — patterned after the smith-plumbing demo fixture.",
    demoSeed: "/demo/smith-plumbing",
    defaultDesignStyleId: "funnel-ready",
    pages: [
      {
        slug: "home",
        path: "/",
        title: "Homepage",
        purpose: "Call-first offer, service area, and primary CTA.",
        keywordPattern: "{niche} in {city}",
      },
      {
        slug: "services",
        path: "/services",
        title: "Services",
        purpose: "Plain-language service list with from-prices where known.",
        keywordPattern: "{niche} services {city}",
      },
      {
        slug: "emergency",
        path: "/emergency",
        title: "Emergency / urgent",
        purpose: "Tap-to-call path for urgent jobs (optional for non-emergency niches).",
        keywordPattern: "emergency {niche} {city}",
      },
      {
        slug: "contact",
        path: "/contact",
        title: "Contact",
        purpose: "Phone, form, hours, and service area.",
        keywordPattern: "contact {businessName}",
      },
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio / studio",
    description: "Home, about, portfolio, exhibitions, contact — patterned after the kurtis demo fixture.",
    demoSeed: "/demo/kurtis",
    defaultDesignStyleId: "photo-focus",
    pages: [
      {
        slug: "home",
        path: "/",
        title: "Homepage",
        purpose: "Selected work and studio positioning.",
        keywordPattern: "{businessName} {niche}",
      },
      {
        slug: "about",
        path: "/about",
        title: "About",
        purpose: "Artist / studio bio without a sales funnel tone.",
        keywordPattern: "about {businessName}",
      },
      {
        slug: "portfolio",
        path: "/portfolio",
        title: "Portfolio",
        purpose: "Work grid / series index.",
        keywordPattern: "{niche} portfolio",
      },
      {
        slug: "exhibitions",
        path: "/exhibitions",
        title: "Exhibitions",
        purpose: "Shows and upcoming dates.",
        keywordPattern: "{businessName} exhibitions",
      },
      {
        slug: "contact",
        path: "/contact",
        title: "Contact",
        purpose: "Inquiries.",
        keywordPattern: "contact {businessName}",
      },
    ],
  },
  {
    id: "general",
    name: "General small business",
    description: "Home, services, about, contact — default when niche is unclear.",
    demoSeed: "/demo/smith-plumbing",
    defaultDesignStyleId: "neon-glass",
    pages: [
      {
        slug: "home",
        path: "/",
        title: "Homepage",
        purpose: "Offer, proof, and primary CTA.",
        keywordPattern: "{businessName} {city}",
      },
      {
        slug: "services",
        path: "/services",
        title: "Services",
        purpose: "What you sell, in plain language.",
        keywordPattern: "{niche} services",
      },
      {
        slug: "about",
        path: "/about",
        title: "About",
        purpose: "Who you are and why someone should trust you.",
        keywordPattern: "about {businessName}",
      },
      {
        slug: "contact",
        path: "/contact",
        title: "Contact",
        purpose: "How to reach you.",
        keywordPattern: "contact {businessName}",
      },
    ],
  },
];

export function getClientTemplate(id: string | undefined): ClientTemplate {
  return CLIENT_TEMPLATES.find((t) => t.id === id) || CLIENT_TEMPLATES[2];
}

export function inferTemplateId(input: {
  niche?: string;
  businessType?: string;
  label?: string;
  goals?: string;
}): ClientTemplateId {
  const blob = [input.niche, input.businessType, input.label, input.goals]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/artist|portfolio|gallery|photo|studio|exhibition/.test(blob)) return "portfolio";
  if (
    /plumb|hvac|electr|roof|landscap|barber|salon|contractor|dentist|lawyer|food truck|local service|emergency/.test(
      blob
    )
  ) {
    return "local-service";
  }
  if (input.businessType?.toLowerCase().includes("portfolio")) return "portfolio";
  if (input.businessType?.toLowerCase().includes("local")) return "local-service";
  return "general";
}

function fill(pattern: string, ctx: Record<string, string>): string {
  return pattern
    .replace(/\{businessName\}/g, ctx.businessName || "Business")
    .replace(/\{niche\}/g, ctx.niche || "services")
    .replace(/\{city\}/g, ctx.city || "your area")
    .replace(/\{state\}/g, ctx.state || "");
}

export function seedPagesForTemplate(
  templateId: ClientTemplateId,
  ctx: { businessName: string; niche: string; city: string; state: string }
): SeededClientPage[] {
  const template = getClientTemplate(templateId);
  const vars = {
    businessName: ctx.businessName,
    niche: ctx.niche,
    city: ctx.city,
    state: ctx.state,
  };
  return template.pages.map((page) => {
    const keyword = fill(page.keywordPattern, vars).replace(/\s+/g, " ").trim();
    const title =
      page.slug === "home"
        ? `${ctx.businessName}${ctx.city ? ` · ${ctx.city}` : ""}`
        : `${page.title} · ${ctx.businessName}`;
    return {
      slug: page.slug,
      path: page.path,
      title,
      purpose: page.purpose,
      targetKeywords: [keyword].filter(Boolean),
    };
  });
}

/** Templates that sell appointments/jobs; only these may talk about booking. */
const BOOKING_TEMPLATES: ReadonlySet<ClientTemplateId> = new Set(["local-service"]);

/**
 * Label for a planned page, from the CURRENT template definition (stored seededPages can carry older wording).
 * Non-service templates (portfolio/artist, general) never mention booking.
 */
export function plannedPagePurpose(
  templateId: string | undefined,
  page: { slug: string; purpose?: string }
): string {
  const template = getClientTemplate(templateId);
  const purpose = template.pages.find((def) => def.slug === page.slug)?.purpose || page.purpose || "";
  if (BOOKING_TEMPLATES.has(template.id)) return purpose;
  const cleaned = purpose
    .replace(/\s*(?:,|and|&|\/)\s*\bbook(?:ing|ings|ed)?\b/gi, "")
    .replace(/\bbook(?:ing|ings|ed)?\b\s*(?:,|and|&|\/)\s*/gi, "")
    .replace(/\bbook(?:ing|ings|ed)?\b/gi, "inquiries")
    .trim();
  return cleaned || (page.slug === "contact" ? "Inquiries." : purpose);
}
