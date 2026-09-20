import type {
  BlueprintPage,
  ContentBrief,
  FactoryPage,
  FactoryProject,
  FactoryStage,
  TopicCluster,
} from "./types";
import { FACTORY_PROJECT_ID } from "./types";

export const PRODUCTION_ORIGIN = "https://sitesinc.co";

export const PUBLIC_PATHS = [
  "/",
  "/blog",
  "/blog/real-small-business-website-needs",
  "/blog/diy-vs-done-for-you-websites",
  "/shop",
  "/shop/product/mack-makeup-bundle",
  "/shop/product/home-gym-bundle",
  "/shop/product/home-pet-grooming-kit",
  "/shop/product/longevity-life-bundle",
  "/shop/product/financial-consulting",
  "/shop/product/gold-filled-jewelry",
  "/cart",
  "/checkout",
  "/privacy",
  "/terms",
  "/thank-you",
] as const;

export const STAGE_DEFS: Omit<
  FactoryStage,
  "status" | "artifacts" | "operatorApproval" | "approvedBy" | "approvedAt" | "completedAt" | "notes"
>[] = [
  {
    key: "research",
    order: 1,
    name: "Research",
    requiredInputs: [
      "Live production URL",
      "Dated baseline snapshot",
      "Competitor URLs (public sites only)",
    ],
  },
  {
    key: "blueprint",
    order: 2,
    name: "Blueprint",
    requiredInputs: [
      "Approved research notes",
      "Topic clusters",
      "Existing page inventory",
    ],
  },
  {
    key: "content_briefs",
    order: 3,
    name: "Content Briefs",
    requiredInputs: [
      "Approved blueprint",
      "Search intent per page",
      "Competitor URLs and gaps",
    ],
  },
  {
    key: "content_drafting",
    order: 4,
    name: "Content Drafting",
    requiredInputs: ["Approved content brief for that page"],
  },
  {
    key: "human_approval",
    order: 5,
    name: "Human Approval",
    requiredInputs: ["Draft copy", "Meta titles/descriptions", "Operator review"],
  },
  {
    key: "technical_seo",
    order: 6,
    name: "Technical SEO",
    requiredInputs: [
      "Approved copy",
      "Canonical/sitemap/robots plan",
      "Schema and OG checklist",
    ],
  },
  {
    key: "staging_build",
    order: 7,
    name: "Staging Build",
    requiredInputs: ["Technical preflight", "Noindex staging host"],
  },
  {
    key: "production_deployment",
    order: 8,
    name: "Production Deployment",
    requiredInputs: [
      "Staging QA pass",
      "Explicit operator approval",
      "Rollback snapshot",
    ],
  },
  {
    key: "indexing_submission",
    order: 9,
    name: "Indexing Submission",
    requiredInputs: ["Live canonical URLs", "Sitemap", "Optional Search Console"],
  },
  {
    key: "backlink_authority",
    order: 10,
    name: "Backlink/Authority Work",
    requiredInputs: ["Published destination URLs", "Ethical acquisition notes"],
  },
  {
    key: "monitoring_reporting",
    order: 11,
    name: "Monitoring and Reporting",
    requiredInputs: ["Indexed pages or Search Console", "Conversion checks"],
  },
];

export function emptyStage(
  def: (typeof STAGE_DEFS)[number],
  extras?: Partial<FactoryStage>
): FactoryStage {
  return {
    ...def,
    status: "not_started",
    artifacts: [],
    operatorApproval: false,
    approvedBy: "",
    approvedAt: "",
    completedAt: "",
    notes: "",
    ...extras,
  };
}

export function createProject(): FactoryProject {
  return {
    id: FACTORY_PROJECT_ID,
    name: "Sitesinc Growth Case Study",
    internal: true,
    brand: "Sitesinc",
    productionUrl: PRODUCTION_ORIGIN,
    stagingPath: "/app/staging",
    productionProtected: true,
    createdAt: new Date().toISOString(),
    notes:
      "Internal factory run: Sitesinc builds Sitesinc. Production stays live. Staging is noindex. No spam tactics, no guaranteed rankings.",
  };
}

export const CLUSTERS: TopicCluster[] = [
  {
    id: "website-design",
    topic: "small-business website design",
    intent: "Learn what a custom small-business site includes and whether to hire it done.",
    hubPath: "/website-design",
    supporting: ["/", "/blog/real-small-business-website-needs"],
    notes: "Service explainer, not a template gallery doorway.",
  },
  {
    id: "packages",
    topic: "affordable website packages",
    intent: "Compare a one-time build vs DIY builders and understand what’s included.",
    hubPath: "/packages",
    supporting: ["/#pricing", "/shop"],
    notes: "One pricing-depth page. Do not clone by city or ‘cheap websites in X’.",
  },
  {
    id: "redesign",
    topic: "website redesign",
    intent: "Decide when an existing site should be rebuilt vs patched.",
    hubPath: "/website-redesign",
    supporting: ["/blog/diy-vs-done-for-you-websites"],
    notes: "Honest about when redesign is not the right move.",
  },
  {
    id: "seo-ready",
    topic: "SEO-ready websites",
    intent: "Understand on-page foundations a new site should launch with.",
    hubPath: "/seo-ready-websites",
    supporting: ["/blog"],
    notes: "Foundations only. No ranking guarantees.",
  },
  {
    id: "monitoring",
    topic: "website monitoring",
    intent: "See what post-launch care actually covers.",
    hubPath: "/website-monitoring",
    supporting: ["/#pricing"],
    notes: "Optional $129/mo plan. Site works without it.",
  },
  {
    id: "industry",
    topic: "relevant industry pages",
    intent: "Help local service owners picture the same factory applied to their shop.",
    hubPath: "/for-local-service-businesses",
    supporting: ["/"],
    notes: "One useful pillar (barber, contractor, food truck, coach) — not duplicate city/industry copies.",
  },
];

export const BLUEPRINT: BlueprintPage[] = [
  {
    slug: "home",
    path: "/",
    title: "Homepage (live production — do not replace)",
    purpose: "Offer, designs, pricing, proof. Baseline stays as-is until a separate homepage brief is approved.",
    clusterId: "website-design",
    existing: true,
    thinDoorwayRisk: "none",
  },
  {
    slug: "website-design",
    path: "/website-design",
    title: "Small-business website design",
    purpose: "Explain the done-for-you Next.js build without repeating the homepage pitch word-for-word.",
    clusterId: "website-design",
    existing: false,
    thinDoorwayRisk: "none",
  },
  {
    slug: "packages",
    path: "/packages",
    title: "Website packages",
    purpose: "What’s in the $1,995 build vs optional $129/mo monitoring — one page, no coupon spam.",
    clusterId: "packages",
    existing: false,
    thinDoorwayRisk: "watched",
  },
  {
    slug: "website-redesign",
    path: "/website-redesign",
    title: "Website redesign",
    purpose: "When to rebuild, what we keep, what we throw out.",
    clusterId: "redesign",
    existing: false,
    thinDoorwayRisk: "none",
  },
  {
    slug: "seo-ready-websites",
    path: "/seo-ready-websites",
    title: "SEO-ready websites",
    purpose: "Titles, structure, sitemap, forms — the launch checklist, not ‘we rank you #1’.",
    clusterId: "seo-ready",
    existing: false,
    thinDoorwayRisk: "none",
  },
  {
    slug: "website-monitoring",
    path: "/website-monitoring",
    title: "Website monitoring",
    purpose: "Uptime, small edits, and what the optional plan does not include.",
    clusterId: "monitoring",
    existing: false,
    thinDoorwayRisk: "none",
  },
  {
    slug: "for-local-service-businesses",
    path: "/for-local-service-businesses",
    title: "For local service businesses",
    purpose: "One industry pillar with distinct sections. No city doorway pages.",
    clusterId: "industry",
    existing: false,
    thinDoorwayRisk: "watched",
  },
];

function brief(partial: Omit<ContentBrief, "status" | "approvedBy" | "approvedAt" | "notes">): ContentBrief {
  return { ...partial, status: "ready_for_review", approvedBy: "", approvedAt: "", notes: "" };
}

export const SEED_BRIEFS: ContentBrief[] = [
  brief({
    id: "brief-website-design",
    slug: "website-design",
    title: "Small-business website design",
    searchIntent:
      "Informational / commercial investigation: what a real custom small-business website includes vs a builder template.",
    competitorUrls: [
      "https://www.wix.com",
      "https://www.squarespace.com",
      "https://www.godaddy.com/websites/website-builder",
    ],
    wordCountGuidance: {
      min: 900,
      max: 1400,
      note: "Guidance only. Completeness and usefulness beat hitting a number.",
    },
    headings: [
      "What a small-business site has to do in the first 5 seconds",
      "Custom Next.js vs drag-and-drop",
      "What we actually build",
      "What we need from you",
      "When this is the wrong fit",
    ],
    recurringTopics: [
      "Phone/CTA above the fold",
      "You own the code",
      "5–7 business day turnaround",
      "Hosting included",
    ],
    gaps: [
      "Builders talk features; few explain code ownership and lock-in in plain language.",
      "Few competitors show a live site that is the product (sitesinc.co itself).",
    ],
    outline: [
      "Job of the site (calls, bookings, trust)",
      "Stack in one paragraph",
      "Included vs not included",
      "Timeline",
      "CTA to pricing — no fake scarcity beyond the published first-10 offer",
    ],
    citations: [
      "Live Sitesinc homepage offer and included list (content.json)",
      "Public competitor marketing pages listed above — used for gap notes, not copied.",
    ],
  }),
  brief({
    id: "brief-packages",
    slug: "packages",
    title: "Website packages",
    searchIntent: "Transactional / commercial: what do I pay, once, and what do I get.",
    competitorUrls: [
      "https://www.squarespace.com/pricing",
      "https://www.wix.com/plans",
    ],
    wordCountGuidance: {
      min: 800,
      max: 1200,
      note: "Guidance only. Must stay consistent with live Stripe prices.",
    },
    headings: [
      "One-time build",
      "Optional care plan",
      "What is not a package",
      "How payment works",
    ],
    recurringTopics: ["$1,995 starting", "50% to start / 50% at launch", "$129/mo optional", "No required subscription"],
    gaps: [
      "Subscription builders hide the long-term cost. This page should show 12-month math without bashing.",
    ],
    outline: [
      "Price table matching the homepage",
      "What’s included",
      "Optional monitoring",
      "CTA to Stripe — same URLs as production",
    ],
    citations: ["content.json pricing", "Live Stripe checkout links on production"],
  }),
  brief({
    id: "brief-website-redesign",
    slug: "website-redesign",
    title: "Website redesign",
    searchIntent: "Commercial investigation: should I rebuild my current site.",
    competitorUrls: ["https://www.webflow.com", "https://wordpress.com"],
    wordCountGuidance: {
      min: 800,
      max: 1300,
      note: "Guidance only.",
    },
    headings: [
      "Signs the current site is costing you calls",
      "What we keep (domain, content, photos)",
      "What we replace",
      "When not to redesign",
    ],
    recurringTopics: ["Own the code", "5–7 days after content", "One round of revisions"],
    gaps: ["Most redesign pitches never say ‘don’t rebuild yet’."],
    outline: [
      "Diagnostic questions",
      "Migration of domain/email",
      "CTA only if a rebuild is warranted",
    ],
    citations: ["Existing blog: DIY vs done-for-you"],
  }),
  brief({
    id: "brief-seo-ready-websites",
    slug: "seo-ready-websites",
    title: "SEO-ready websites",
    searchIntent: "Informational: what on-page SEO a new site should launch with.",
    competitorUrls: ["https://developers.google.com/search/docs/fundamentals/seo-starter-guide"],
    wordCountGuidance: {
      min: 900,
      max: 1400,
      note: "Guidance only. No ranking promises.",
    },
    headings: [
      "Titles, descriptions, and one H1",
      "Sitemap, robots, canonicals",
      "Internal links that help a human",
      "Forms that actually notify someone",
      "What SEO-ready does not mean",
    ],
    recurringTopics: ["Indexation is not guaranteed", "Search Console is optional until connected"],
    gaps: ["Agencies claim ‘SEO included’ without listing the actual artifacts."],
    outline: [
      "Launch checklist",
      "What we submit vs what Google decides",
      "Link to this internal factory case study when outcomes exist",
    ],
    citations: ["Google SEO Starter Guide (public)", "This project’s technical preflight"],
  }),
  brief({
    id: "brief-website-monitoring",
    slug: "website-monitoring",
    title: "Website monitoring",
    searchIntent: "Commercial: do I need a care plan after launch.",
    competitorUrls: ["https://www.netlify.com"],
    wordCountGuidance: {
      min: 700,
      max: 1100,
      note: "Guidance only.",
    },
    headings: [
      "What ‘monitoring’ means here",
      "What the $129/mo plan covers",
      "What you can skip",
    ],
    recurringTopics: ["Optional", "Uptime", "Small copy/image edits"],
    gaps: ["Care plans often bury the fact that the site runs without them."],
    outline: ["Included", "Not included", "How to cancel / not start"],
    citations: ["content.json maintenance features"],
  }),
  brief({
    id: "brief-local-service",
    slug: "for-local-service-businesses",
    title: "For local service businesses",
    searchIntent:
      "Informational: how a barber, contractor, food truck, or coach should use a site — one page, not 40 city clones.",
    competitorUrls: ["https://www.wix.com/website/templates"],
    wordCountGuidance: {
      min: 1000,
      max: 1600,
      note: "Guidance only. Distinct sections, not duplicated paragraphs with the industry name swapped.",
    },
    headings: [
      "What local service sites forget",
      "Barbers & personal care",
      "Contractors & trades",
      "Food trucks & hospitality",
      "Coaches & solo pros",
      "One factory, not 50 doorways",
    ],
    recurringTopics: ["Tap-to-call", "Clear prices or ‘from’ prices", "Real photos"],
    gaps: ["Template marketplaces spawn thin city pages. This page must refuse that pattern."],
    outline: [
      "Shared principles",
      "Four short industry sections with unique examples",
      "CTA to packages",
    ],
    citations: ["Homepage trust line niches", "Blog: what a real small-business site needs"],
  }),
];

export function draftPagesFromBriefs(briefs: ContentBrief[]): FactoryPage[] {
  return BLUEPRINT.filter((page) => !page.existing).map((page) => {
    const briefRow = briefs.find((item) => item.slug === page.slug);
    return {
      slug: page.slug,
      path: page.path,
      title: page.title,
      metaDescription: "",
      status: briefRow?.status === "approved" ? "drafting" : "brief_required",
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

export const DISCLAIMERS = {
  indexing:
    "Submitting a URL or sitemap does not guarantee discovery, crawling, or indexing.",
  rankings: "Sitesinc does not guarantee rankings, leads, or revenue.",
  production: "Production stays live until staging passes QA and an operator explicitly approves deploy.",
  backlinks: "Do not automate spam links or record links that were not actually earned.",
};
