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
  footerNote?: string;
  services: MiniSiteService[];
  testimonials: MiniSiteTestimonial[];
  trustSignals: string[];
};

export const SITESYNC_SITE: MiniSiteContent = {
  business: "Sitesync Business",
  tagline:
    "Ultra-modern websites that finally make your small business look big. Live now at sitesinc.co.",
  cta: "Reserve My Build",
  phone: "save@sitesinc.co",
  footerNote: "save@sitesinc.co · Live at sitesinc.co · You own the code",
  services: [
    {
      name: "Complete website build",
      price: "$749.50",
      blurb: "Launch price for the first 10 businesses. Regular $1,499, one-time.",
    },
    {
      name: "Netlify hosting",
      price: "Included",
      blurb: "SSL, global CDN, and your domain connected — this site is the proof.",
    },
    {
      name: "SEO, funnels & Stripe",
      price: "Included",
      blurb: "On-page SEO, lead capture, and checkout ready from day one.",
    },
    {
      name: "Optional maintenance",
      price: "$125/mo",
      blurb: "Updates, monitoring, and small text/image changes if you want them.",
    },
  ],
  testimonials: [
    {
      name: "sitesinc.co",
      quote:
        "This live site is the product — Next.js, Tailwind, Stripe, and Netlify hosting included.",
    },
    {
      name: "Launch offer",
      quote:
        "First 10 businesses lock in 50% off. One-time build, no subscription, you own the code.",
    },
    {
      name: "Turnaround",
      quote:
        "5–7 business days from content received to a hosted, money-ready site.",
    },
  ],
  trustSignals: [
    "You own the code",
    "5–7 day turnaround",
    "Stripe-ready",
    "Hosting included",
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
