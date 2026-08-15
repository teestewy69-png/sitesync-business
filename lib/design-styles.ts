export type DesignStyleId =
  | "neon-glass"
  | "purple-gradient"
  | "minimal-dark"
  | "split-hero"
  | "card-grid"
  | "bold-type"
  | "photo-focus"
  | "funnel-ready";

export type DesignStyle = {
  id: DesignStyleId;
  name: string;
  accent: string;
};

export const DESIGN_STYLES: DesignStyle[] = [
  { id: "neon-glass", name: "Neon Glass", accent: "#e0b954" },
  { id: "purple-gradient", name: "Purple Gradient", accent: "#a855f7" },
  { id: "minimal-dark", name: "Minimal Dark", accent: "#f97316" },
  { id: "split-hero", name: "Split Hero", accent: "#22c55e" },
  { id: "card-grid", name: "Card Grid", accent: "#eab308" },
  { id: "bold-type", name: "Bold Type", accent: "#3b82f6" },
  { id: "photo-focus", name: "Photo Focus", accent: "#ec4899" },
  { id: "funnel-ready", name: "Funnel Ready", accent: "#f43f5e" },
];

export type MiniSiteService = {
  name: string;
  price: string;
  blurb: string;
};

export type MiniSiteTestimonial = {
  name: string;
  quote: string;
};

export type MiniSiteContent = {
  business: string;
  tagline: string;
  cta: string;
  phone: string;
  services: MiniSiteService[];
  testimonials: MiniSiteTestimonial[];
  trustSignals: string[];
};

export const TOMS_ROOFS: MiniSiteContent = {
  business: "Tom's Roofs",
  tagline:
    "Storm-ready roofing for homes that need repair, replacement, and peace of mind.",
  cta: "Get a Free Quote",
  phone: "(555) 014-7782",
  services: [
    {
      name: "Roof Repair",
      price: "From $349",
      blurb: "Leak fixes, shingle replacement, and storm damage patchwork.",
    },
    {
      name: "New Roof",
      price: "From $8,500",
      blurb: "Full tear-off and install with premium materials.",
    },
    {
      name: "Gutter Service",
      price: "From $149",
      blurb: "Cleaning, realignment, and downspout upgrades.",
    },
    {
      name: "Inspection",
      price: "Free",
      blurb: "On-site assessment with a clear written estimate.",
    },
  ],
  testimonials: [
    {
      name: "Maria K.",
      quote:
        "Tom's Roofs fixed our leak the same week and left the yard spotless.",
    },
    {
      name: "James R.",
      quote:
        "New roof looks incredible. Fair price, clear timeline, zero surprises.",
    },
    {
      name: "Diane P.",
      quote:
        "The free inspection sold us — honest advice and a crew we trust.",
    },
  ],
  trustSignals: [
    "Licensed & insured",
    "5-star local reviews",
    "Same-week scheduling",
    "Written estimates",
  ],
};

export function buildPreviewContent(
  businessName: string,
  keyword: string,
): MiniSiteContent {
  const business = businessName.trim() || "Your Business";
  const serviceWord = keyword.trim() || "services";
  const tagline = keyword.trim()
    ? `Professional ${keyword.trim()} that turns visitors into booked jobs.`
    : "A polished online presence that turns visitors into booked jobs.";

  return {
    business,
    tagline,
    cta: `Contact ${business}`,
    phone: "(555) 010-2400",
    services: [
      {
        name: keyword.trim() ? `${capitalize(serviceWord)} Consult` : "Starter Package",
        price: "From $99",
        blurb: `Quick intro call to map the right ${serviceWord} plan.`,
      },
      {
        name: keyword.trim() ? `${capitalize(serviceWord)} Core` : "Core Service",
        price: "From $299",
        blurb: `The most-booked ${serviceWord} option for busy customers.`,
      },
      {
        name: "Premium Bundle",
        price: "From $799",
        blurb: "Priority scheduling, extras, and white-glove follow-up.",
      },
      {
        name: "Free Estimate",
        price: "Free",
        blurb: "No-pressure quote tailored to your project.",
      },
    ],
    testimonials: [
      {
        name: "Alex M.",
        quote: `${business} made booking effortless — clear pricing and fast replies.`,
      },
      {
        name: "Sam T.",
        quote: `We found ${business} online and hired them the same day. Highly recommend.`,
      },
      {
        name: "Riley C.",
        quote: `Professional ${serviceWord}, honest communication, and a site that feels trustworthy.`,
      },
    ],
    trustSignals: [
      "Trusted locally",
      "Fast response",
      "Transparent pricing",
      "Satisfaction focused",
    ],
  };
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
