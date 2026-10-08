import type {
  BlueprintPage,
  ContentBrief,
  FactoryPage,
  FactoryProject,
  FactoryStage,
  TopicCluster,
} from "./types";
import { STAGE_DEFS, emptyStage } from "./pipeline";
import type { ClientBuildConfig } from "./client-config";
import { getClientTemplate } from "./client-templates";

function place(parts: string[]): string {
  return parts.filter(Boolean).join(", ");
}

export function createClientFactoryProject(
  projectId: string,
  config: ClientBuildConfig
): FactoryProject {
  const loc = place([config.city, config.state]);
  return {
    id: projectId,
    name: `${config.businessName} client build`,
    internal: false,
    brand: config.businessName,
    productionUrl: "",
    stagingPath: `/demo/client/${projectId}`,
    productionProtected: true,
    createdAt: new Date().toISOString(),
    notes: [
      `Client-scoped factory workspace for ${config.businessName}.`,
      config.niche ? `Niche: ${config.niche}.` : "",
      loc ? `Location: ${loc}.` : "",
      `Template: ${config.templateId}. Design: ${config.designStyleId}.`,
      "Not Sitesinc's growth case study. No auto-publish to Netlify.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export function seedClientStages(): FactoryStage[] {
  return STAGE_DEFS.map((def) =>
    emptyStage(def, {
      notes:
        def.key === "research"
          ? "Client research uses this business's niche/location. Attach real competitor URLs on each brief (analyze top 3) — not a free-floating checkbox."
          : "",
    })
  );
}

export function seedClientClusters(config: ClientBuildConfig): TopicCluster[] {
  const loc = place([config.city, config.state]) || "service area";
  const niche = config.niche || "services";
  const offer = config.offer || niche;
  if (config.templateId === "portfolio") {
    return [
      {
        id: "offer",
        topic: `${offer}`,
        intent: `See ${config.businessName}'s work and what is available.`,
        hubPath: "/",
        supporting: ["/portfolio", "/contact"],
        notes: `Work by ${config.businessName}${config.city ? ` (${loc})` : ""}. Real images and titles only.`,
      },
      {
        id: "trust",
        topic: `${config.businessName} background`,
        intent: "Learn about the artist, shows and how to inquire.",
        hubPath: "/about",
        supporting: ["/exhibitions", "/contact"],
        notes: "Bio, confirmed exhibitions only, inquiry path. No invented shows, press or reviews.",
      },
    ];
  }
  return [
    {
      id: "offer",
      topic: `${niche} offer`,
      intent: `Understand what ${config.businessName} sells and who it is for.`,
      hubPath: "/",
      supporting: ["/services", "/contact"],
      notes: `Client hub for ${offer} in ${loc}.`,
    },
    {
      id: "services",
      topic: `${niche} services`,
      intent: "Compare service options (prices only if the client provides them).",
      hubPath: "/services",
      supporting: ["/", "/contact"],
      notes: "One services page. City pages come from City Launch (quality-gated, unique per city).",
    },
    {
      id: "trust",
      topic: `${config.businessName} trust`,
      intent: "Decide whether to get in touch.",
      hubPath: "/contact",
      supporting: ["/", "/about", "/services"],
      notes: "Real proof only, hours, phone, form.",
    },
  ];
}

export function seedClientBlueprint(config: ClientBuildConfig): BlueprintPage[] {
  const template = getClientTemplate(config.templateId);
  return template.pages.map((page) => ({
    slug: page.slug,
    path: page.path,
    title:
      page.slug === "home"
        ? `${config.businessName} homepage`
        : `${page.title} · ${config.businessName}`,
    purpose: page.purpose,
    clusterId:
      page.slug === "services" || page.slug === "emergency"
        ? "services"
        : page.slug === "contact" || page.slug === "about"
          ? "trust"
          : "offer",
    existing: false,
    thinDoorwayRisk: page.slug === "emergency" ? "watched" : "none",
  }));
}

function briefShell(
  partial: Omit<ContentBrief, "status" | "approvedBy" | "approvedAt" | "notes"> & {
    notes?: string;
  }
): ContentBrief {
  return {
    ...partial,
    status: "ready_for_review",
    approvedBy: "",
    approvedAt: "",
    notes:
      partial.notes ||
      "competitorUrls starts empty — operator attaches top-3 public competitor URLs on this brief (analyze top 3).",
  };
}

/** Template-appropriate brief headings. Portfolio pages never get service-area / booking headings. */
export function clientBriefHeadings(config: ClientBuildConfig, slug: string, loc: string): string[] {
  if (config.templateId === "portfolio") {
    const bySlug: Record<string, string[]> = {
      about: [`About ${config.businessName}`, "The work", `Based in ${loc}`],
      portfolio: ["Selected work", "Available originals", "How to inquire"],
      exhibitions: ["Exhibitions", "Upcoming", "Gallery and representation inquiries"],
      contact: [`Contact ${config.businessName}`, "Inquiries", "Pricing and availability"],
    };
    return [...(bySlug[slug] || [`${config.businessName}`, "The work", "How to inquire"]), "What this page is not"];
  }
  return [`What ${config.businessName} offers`, `Who this helps in ${loc}`, "How to get started", "What this page is not"];
}

export function seedClientBriefs(config: ClientBuildConfig): ContentBrief[] {
  const loc = place([config.city, config.state]) || "the service area";
  const niche = config.niche || "services";
  const pages = seedClientBlueprint(config);

  return pages
    .filter((page) => page.slug !== "home")
    .map((page) =>
      briefShell({
        id: `brief-${page.slug}`,
        slug: page.slug,
        title: page.title,
        searchIntent: `${page.purpose} for ${config.businessName} (${niche}, ${loc}).`,
        competitorUrls: [],
        wordCountGuidance: {
          min: 500,
          max: 1100,
          note: "Guidance only. Completeness beats hitting a number. No ranking promises.",
        },
        headings: clientBriefHeadings(config, page.slug, loc),
        recurringTopics: [
          config.businessName,
          niche,
          loc,
          config.primaryGoal || "clear next step",
        ].filter(Boolean),
        gaps: [
          "Operator must attach 1–3 real public competitor URLs before approving this brief.",
          "Do not invent rankings, reviews, or licenses the client has not confirmed.",
        ],
        outline: [
          `Open with ${config.businessName} and ${config.offer ? `what they sell (${config.offer})` : `the ${niche} offer`}`,
          config.templateId === "portfolio"
            ? `Where the work is made (${loc})`
            : `Local context for ${loc} (city pages via City Launch quality gate)`,
          config.templateId === "portfolio" ? "CTA: inquire about a work" : "CTA: call / form / book",
        ],
        citations: [
          "Client intake config (business name, niche, city/state, goal)",
          "Bound template page purpose",
        ],
      })
    );
}

export function seedClientPages(
  briefs: ContentBrief[],
  blueprint: BlueprintPage[]
): FactoryPage[] {
  return blueprint.map((page) => {
    const briefRow = briefs.find((item) => item.slug === page.slug);
    return {
      slug: page.slug,
      path: page.path,
      title: page.title,
      metaDescription: "",
      status: page.slug === "home" ? "planned" : briefRow ? "brief_required" : "planned",
      briefId: briefRow?.id || "",
      wordCount: 0,
      headings: briefRow?.headings || [],
      body: "",
      noindex: true,
      approvedBy: "",
      approvedAt: "",
      publishedAt: "",
    };
  });
}

/** Structured research stub — honest placeholders, not LLM output. */
export function seedClientResearchNotes(config: ClientBuildConfig): string {
  const loc = place([config.city, config.state]) || "(location not provided)";
  return [
    `Client: ${config.businessName}`,
    config.contactName ? `Contact: ${config.contactName}` : null,
    `Niche / type: ${config.niche} / ${config.businessType}`,
    config.offer ? `Sells: ${config.offer}` : null,
    `Location: ${loc}`,
    `Primary goal: ${config.primaryGoal || "(not set)"}`,
    `Phone: ${config.phone || "(not set)"}`,
    `Pricing: ${config.pricingNote || "(no pricing provided - previews show no prices)"}`,
    config.domain ? `Client-owned domain: ${config.domain}` : null,
    `Design: ${config.designStyleId} · Template: ${config.templateId}`,
    "",
    "Research stage is seeded from intake config only.",
    "No automated LLM competitor crawl. Attach real competitor URLs on each content brief (competitorUrls).",
    "Baseline: the client preview is crawled automatically at setup and again after every edit, design or draft change (status on the client page; Capture re-runs it). Results are real crawl data, never invented.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
