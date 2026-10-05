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
  return [
    {
      id: "offer",
      topic: `${niche} offer`,
      intent: `Understand what ${config.businessName} sells and who it is for.`,
      hubPath: "/",
      supporting: ["/services", "/contact"],
      notes: `Client hub for ${niche} in ${loc}.`,
    },
    {
      id: "services",
      topic: `${niche} services`,
      intent: "Compare service options and from-prices.",
      hubPath: "/services",
      supporting: ["/", "/contact"],
      notes: "One services page — not city doorway clones.",
    },
    {
      id: "trust",
      topic: `${config.businessName} trust`,
      intent: "Decide whether to call / book.",
      hubPath: "/contact",
      supporting: ["/", "/about", "/services"],
      notes: "Proof, hours, phone, form.",
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
        headings: [
          `What ${config.businessName} offers`,
          `Who this helps in ${loc}`,
          "How to get started",
          "What this page is not",
        ],
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
          `Open with ${config.businessName} and the ${niche} offer`,
          `Local context for ${loc} without doorway spam`,
          "CTA: call / form / book",
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
    `Niche / type: ${config.niche} / ${config.businessType}`,
    `Location: ${loc}`,
    `Primary goal: ${config.primaryGoal || "(not set)"}`,
    `Phone: ${config.phone || "(not set)"}`,
    `Design: ${config.designStyleId} · Template: ${config.templateId}`,
    "",
    "Research stage is seeded from intake config only.",
    "No automated LLM competitor crawl. Attach real competitor URLs on each content brief (competitorUrls).",
    "Baseline crawl is optional and operator-triggered — not invented.",
  ].join("\n");
}
