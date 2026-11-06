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
  blurb: string;
};

export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: "neon-glass",
    name: "Neon Glass",
    accent: "#e0b954",
    blurb: "Glassy panels and a glowing headline. A premium night-time look for shops that want to feel bigger than they are.",
  },
  {
    id: "purple-gradient",
    name: "Purple Gradient",
    accent: "#a855f7",
    blurb: "Split hero with a gradient visual panel. Color-forward for brands that want motion without clutter.",
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    accent: "#f97316",
    blurb: "Quiet dark canvas with four service cards up front. Fast to scan on a phone.",
  },
  {
    id: "split-hero",
    name: "Split Hero",
    accent: "#22c55e",
    blurb: "Visual panel on one side, offer and prices on the other. Classic call-first landing for local services.",
  },
  {
    id: "card-grid",
    name: "Card Grid",
    accent: "#eab308",
    blurb: "Big service tiles with visual blocks. Easy to browse what you sell at a glance.",
  },
  {
    id: "bold-type",
    name: "Bold Type",
    accent: "#3b82f6",
    blurb: "Oversized name, short copy, two featured offers. For businesses whose name should own the fold.",
  },
  {
    id: "photo-focus",
    name: "Photo Focus",
    accent: "#ec4899",
    blurb: "Full-width visual first, then the offer and a featured review. Built for shops with real photos.",
  },
  {
    id: "funnel-ready",
    name: "Funnel Ready",
    accent: "#f43f5e",
    blurb: "Three numbered steps from inquiry to booked. Built to turn visits into calls.",
  },
];

export function isDesignStyleId(value: string): value is DesignStyleId {
  return DESIGN_STYLES.some((style) => style.id === value);
}

export function getDesignStyle(id: string): DesignStyle | undefined {
  return DESIGN_STYLES.find((style) => style.id === id);
}

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

export const SITESINC_SITE: MiniSiteContent = {
  business: "Sitesinc",
  tagline:
    "Ultra-modern websites that finally make your small business look big. Live now at sitesinc.co.",
  cta: "Request My Build",
  phone: "(909) 323-1575",
  footerNote: "save@sitesinc.co · Live at sitesinc.co · You own the code",
  services: [
    {
      name: "Complete website build",
      price: "$1,995",
      blurb: "Website builds are $1,995. Pay 50% to start, 50% at launch.",
    },
    {
      name: "Netlify hosting",
      price: "Included",
      blurb: "SSL, global CDN, and your domain connected — this site is the proof.",
    },
    {
      name: "SEO & lead capture",
      price: "Included",
      blurb: "On-page SEO basics and a lead form that reaches you, from day one.",
    },
    {
      name: "Monitored SEO",
      price: "1st mo free",
      blurb: "Not included in the build: 1st month free • Card required at signup • $129/mo starting day 31 unless canceled before 30 days. Cancel anytime.",
    },
  ],
  testimonials: [
    {
      name: "sitesinc.co",
      quote:
        "This live site is the product — Next.js, Tailwind, and Netlify hosting included.",
    },
    {
      name: "Payment",
      quote:
        "Website builds are $1,995. Pay 50% to start, 50% at launch. Monitored SEO (optional): 1st month free • Card required at signup • $129/mo starting day 31 unless canceled before 30 days. You own the code.",
    },
    {
      name: "Turnaround",
      quote:
        "Timeline is confirmed in writing before work starts.",
    },
  ],
  trustSignals: [
    "You own the code",
    "Clear written timeline",
    "SEO basics built in",
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
    ? `A clear, mobile-friendly website for your ${keyword.trim()} business.`
    : "A clear, mobile-friendly website for your business.";

  return {
    business,
    tagline,
    cta: `Contact ${business}`,
    phone: "Your phone number",
    services: [
      {
        name: keyword.trim() ? `${capitalize(serviceWord)} Consult` : "Starter Package",
        price: "Your price",
        blurb: `Describe your intro or consult offer here.`,
      },
      {
        name: keyword.trim() ? `${capitalize(serviceWord)} Core` : "Core Service",
        price: "Your price",
        blurb: `Describe your main ${serviceWord} offer here.`,
      },
      {
        name: "Premium Bundle",
        price: "Your price",
        blurb: "Describe any extras or add-ons here.",
      },
      {
        name: "Free Estimate",
        price: "Free",
        blurb: "Describe how customers can request an estimate.",
      },
    ],
    testimonials: [
      {
        name: "Placeholder",
        quote: `Your real customer reviews would appear here. This preview does not show real reviews.`,
      },
      {
        name: "Placeholder",
        quote: `Reviews are added only from real customers of ${business}.`,
      },
      {
        name: "Placeholder",
        quote: `Sample layout for ${serviceWord}: your logo, photos and services replace this text.`,
      },
    ],
    trustSignals: [
      "Tap-to-call button",
      "Clear pricing section",
      "Mobile-first layout",
      "Contact form",
    ],

  };
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
