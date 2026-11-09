/**
 * Trade landing pages (/trades/<slug>). Copy rules: facts only. No invented stats,
 * testimonials, client counts, rankings or guarantees. Every number here comes from
 * the Sitesinc offer: $1,995 flat, 50% ($997.50) to start, 50% at launch, pilot
 * $1,495 for the first 3 clients, optional $129/mo monitoring (1st month free).
 */
import { LIVE_PAYMENT_LINKS as PAYMENT_LINKS } from "@/lib/payment-links";

export const SITESINC_PHONE = "(909) 323-1575";
export const SITESINC_PHONE_HREF = "tel:+19093231575";
export const SITESINC_EMAIL = "save@sitesinc.co";
export const SERVICE_AREA = "Los Angeles, Orange, Riverside and San Bernardino counties";
export const SERVICE_AREA_LIST = [
  "Los Angeles County",
  "Orange County",
  "Riverside County",
  "San Bernardino County",
];

/** Live SITESYNC LLC Stripe payment links (shared with Packages/Checkout via lib/payment-links). */
export const STRIPE_LINKS = {
  deposit: PAYMENT_LINKS.startDeposit,
  full: PAYMENT_LINKS.flatRate,
  monitoring: PAYMENT_LINKS.monitoring,
  launchBalance: PAYMENT_LINKS.launchBalance,
};

export type Trade = {
  slug: string;
  name: string; // plural label, e.g. "Plumbers"
  short: string; // card label
  metaTitle: string;
  metaDescription: string;
  overline: string;
  headline: string;
  subheadline: string;
  searchMoment: string;
  problems: string[];
  build: { title: string; text: string }[];
  faqs: { question: string; answer: string }[];
};

export const TRADES: Trade[] = [
  {
    slug: "plumbers",
    name: "Plumbers",
    short: "Plumbing",
    metaTitle: "Websites for Plumbers in Southern California | $1,995 Flat | Sitesinc",
    metaDescription:
      "Plumber websites built for phone calls: tap-to-call, service pages and a quote form that emails you every lead. $1,995 flat, 50% to start. LA, OC, Riverside, San Bernardino.",
    overline: "Websites for plumbers",
    headline: "Somebody near you has water on the floor right now. Can they call you in one tap?",
    subheadline:
      "A plumber website built to get the call, not just look nice: your number at the top of every screen, a page for each service you do, and a quote form that emails you every lead. $1,995 flat for the build.",
    searchMoment:
      "Plumbing customers usually search when something is already wrong. They are on a phone, in a hurry, and want a number to tap.",
    problems: [
      "Your phone number is buried, or not clickable on a phone.",
      "One page lists every service, so nothing explains drain cleaning, water heaters or leak repair on its own.",
      "Quote requests go to an inbox nobody checks, or there is no form at all.",
    ],
    build: [
      { title: "Tap-to-call on every page", text: "Your number stays at the top of every screen on a phone, so the call is one tap away." },
      { title: "A page for each service", text: "Separate pages for the work you want more of, such as drain cleaning, water heaters, leak repair or repiping." },
      { title: "Pages for the cities you drive to", text: "Service-area pages for the cities you actually serve, each written to be unique." },
      { title: "Quote form that emails you", text: "Every request lands in your email with the customer's name, phone and what they need." },
      { title: "Your real job photos", text: "Before-and-after photos from your own jobs, if you have them." },
      { title: "Room for your license number", text: "Show your CSLB license number on the site if you have one." },
    ],
    faqs: [
      {
        question: "Can the site show that I take after-hours calls?",
        answer: "Yes, if you do. We only put hours and services on the site that you tell us are true.",
      },
      {
        question: "Do you guarantee I will rank #1 on Google for plumber searches?",
        answer: "No. Nobody can honestly promise rankings. We set up search-friendly titles, descriptions, service pages, service-area pages and a sitemap so Google can find and understand your site.",
      },
    ],
  },
  {
    slug: "roofers",
    name: "Roofers",
    short: "Roofing",
    metaTitle: "Websites for Roofers in Southern California | $1,995 Flat | Sitesinc",
    metaDescription:
      "Roofing websites that turn searches into estimate requests: tap-to-call, project photos, service-area pages and an estimate form. $1,995 flat. LA, OC, Riverside, San Bernardino.",
    overline: "Websites for roofers",
    headline: "The first rain of the season is your busiest week online. Is your website ready for it?",
    subheadline:
      "A roofing website built to collect estimate requests: project photos that show your work, a page for repairs, re-roofs and inspections, and an estimate form that emails you each lead. $1,995 flat for the build.",
    searchMoment:
      "Homeowners usually look for a roofer after they see a leak or a storm. They compare a few sites quickly and contact the one that looks real and easy to reach.",
    problems: [
      "No project photos, so homeowners can't see the quality of your work.",
      "No clear way to ask for an estimate from a phone.",
      "Nothing on the site says which cities you cover.",
    ],
    build: [
      { title: "Estimate request form", text: "A short form for address, roof problem and best time to call, emailed straight to you." },
      { title: "Project photo gallery", text: "Your real before-and-after roofs, organized so homeowners can scroll them fast." },
      { title: "Service pages", text: "Separate pages for repairs, re-roofs, inspections or whatever work you want more of." },
      { title: "Service-area pages", text: "Pages for the cities you work in across Southern California, each written to be unique." },
      { title: "Tap-to-call on every page", text: "Your number stays one tap away on every phone screen." },
      { title: "Room for your license number", text: "Show your CSLB license number on the site if you have one." },
    ],
    faqs: [
      {
        question: "Can you add an instant price calculator?",
        answer: "The $1,995 build includes a lead form and tap-to-call. Anything beyond what is listed in the build, ask first and we will tell you honestly if it fits.",
      },
      {
        question: "Do I need professional photos?",
        answer: "No. Clear phone photos of your own jobs work. We will tell you which ones to use.",
      },
    ],
  },
  {
    slug: "hvac",
    name: "HVAC Contractors",
    short: "HVAC",
    metaTitle: "Websites for HVAC Contractors in Southern California | $1,995 Flat | Sitesinc",
    metaDescription:
      "HVAC websites built for calls on the hottest days: tap-to-call, AC and heating service pages, service-area pages and a service request form. $1,995 flat. Southern California.",
    overline: "Websites for HVAC contractors",
    headline: "Their AC just quit on a 100° afternoon. They want a number to tap, not a website to dig through.",
    subheadline:
      "An HVAC website built for the moment the system dies: your number one tap away, separate pages for AC repair, heating, installs and maintenance, and a service request form that emails you. $1,995 flat for the build.",
    searchMoment:
      "HVAC customers often search when they are uncomfortable and in a hurry. A clear phone number and a short request form matter more than a fancy homepage.",
    problems: [
      "The site is slow or hard to use on a phone.",
      "AC repair, heating, installs and maintenance plans are all crammed on one page.",
      "There is no simple way to ask for a service visit.",
    ],
    build: [
      { title: "Tap-to-call on every page", text: "Your number stays at the top of every phone screen." },
      { title: "Service pages", text: "Separate pages for AC repair, heating repair, new installs and maintenance, or the work you want more of." },
      { title: "Service request form", text: "Name, phone, address and the problem, emailed straight to you." },
      { title: "Service-area pages", text: "Pages for the cities you cover, from the Inland Empire to the coast, each written to be unique." },
      { title: "Maintenance plan section", text: "If you sell tune-up or maintenance plans, we give them their own section." },
      { title: "Room for your license number", text: "Show your CSLB license number on the site if you have one." },
    ],
    faqs: [
      {
        question: "Can the site push maintenance plans?",
        answer: "Yes. If you offer them, we can give them their own section with a request form. We only list plans and prices you give us.",
      },
      {
        question: "How fast can it be live?",
        answer: "It depends on the project and how quickly we get your content. We don't promise a set number of days. Call us and we'll talk through your project.",
      },
    ],
  },
  {
    slug: "electricians",
    name: "Electricians",
    short: "Electrical",
    metaTitle: "Websites for Electricians in Southern California | $1,995 Flat | Sitesinc",
    metaDescription:
      "Electrician websites that make you look as solid as your work: tap-to-call, service pages for panels, EV chargers and repairs, and a quote form. $1,995 flat. Southern California.",
    overline: "Websites for electricians",
    headline: "Your work passes inspection. Would your website?",
    subheadline:
      "An electrician website that looks as solid as your work: tap-to-call, separate pages for panel upgrades, EV chargers, lighting and repairs, and a quote form that emails you each lead. $1,995 flat for the build.",
    searchMoment:
      "People hiring an electrician want to feel safe about who they let in the house. A clean, professional site with your license and real work photos helps them decide.",
    problems: [
      "The site looks outdated, so customers wonder if the business is still open.",
      "Panel upgrades, EV chargers and repairs are not explained anywhere.",
      "There is no license number, photos or easy way to get a quote.",
    ],
    build: [
      { title: "Service pages", text: "Separate pages for panel upgrades, EV charger installs, lighting, repairs or the work you want more of." },
      { title: "Quote form that emails you", text: "Every request lands in your email with the customer's details." },
      { title: "Tap-to-call on every page", text: "Your number stays one tap away on every phone screen." },
      { title: "Room for your license number", text: "Show your CSLB license number on the site if you have one." },
      { title: "Real job photos", text: "Your own panels, installs and finished work, if you have photos." },
      { title: "Service-area pages", text: "Pages for the cities you serve, each written to be unique." },
    ],
    faqs: [
      {
        question: "I mostly do commercial work. Does this still fit?",
        answer: "Yes. We write the pages around the work you actually want, residential, commercial or both.",
      },
      {
        question: "Do I own the website?",
        answer: "Yes. You get the full code handoff and hosting setup. No platform lock-in.",
      },
    ],
  },
  {
    slug: "landscapers",
    name: "Landscapers",
    short: "Landscaping",
    metaTitle: "Websites for Landscapers in Southern California | $1,995 Flat | Sitesinc",
    metaDescription:
      "Landscaping websites that show off your yards and bring in quote requests: photo galleries, service pages, service-area pages and a quote form. $1,995 flat. Southern California.",
    overline: "Websites for landscapers",
    headline: "Your best yards are stuck in your camera roll. Put them where customers are looking.",
    subheadline:
      "A landscaping website that sells with your own photos: galleries of your best work, pages for design, installs, hardscape and maintenance, and a quote form that emails you each lead. $1,995 flat for the build.",
    searchMoment:
      "Landscaping is a visual buy. People want to see yards you have done before they ask for a quote.",
    problems: [
      "Your best work lives on your phone or Instagram, not on a site Google can find.",
      "Design, installs, hardscape and weekly maintenance are not separated.",
      "No easy quote request, so people move on to the next company.",
    ],
    build: [
      { title: "Photo galleries", text: "Your best yards up front, organized by type of job." },
      { title: "Service pages", text: "Separate pages for design, installs, hardscape, irrigation or maintenance, whatever you offer." },
      { title: "Quote form that emails you", text: "Address, project type and photos of their yard if they want, emailed to you." },
      { title: "Service-area pages", text: "Pages for the cities you work in, each written to be unique." },
      { title: "Tap-to-call on every page", text: "Your number stays one tap away on every phone screen." },
      { title: "Room for your license number", text: "Show your CSLB license number on the site if you have one." },
    ],
    faqs: [
      {
        question: "Can you use my Instagram photos?",
        answer: "Yes, if they are your own work and you send us the files or give us permission to use them.",
      },
      {
        question: "Is there a monthly fee?",
        answer: "The build is $1,995 flat. Monitoring is optional: 1st month free, then $129/mo, cancel anytime. Your site works without it.",
      },
    ],
  },
  {
    slug: "auto-repair",
    name: "Auto Repair Shops",
    short: "Auto repair",
    metaTitle: "Websites for Auto Repair Shops in Southern California | $1,995 Flat | Sitesinc",
    metaDescription:
      "Auto repair shop websites built for drivers searching from their phone: tap-to-call, directions, services, hours and an appointment request form. $1,995 flat. Southern California.",
    overline: "Websites for auto repair shops",
    headline: "Check-engine light on. They're searching from the parking lot. Your site gets one screen to win them.",
    subheadline:
      "An auto repair website built for drivers on a phone: tap-to-call, tap-for-directions, your services and hours up front, and an appointment request form that emails you. $1,995 flat for the build.",
    searchMoment:
      "Drivers often look for a shop when something is already wrong with the car. They want to know you're close, open and easy to reach.",
    problems: [
      "Hours, address and phone are hard to find on a phone.",
      "Services like brakes, diagnostics and oil changes are not listed clearly.",
      "No way to request an appointment without calling.",
    ],
    build: [
      { title: "Tap-to-call and directions", text: "Call and map buttons at the top of every phone screen." },
      { title: "Services and hours up front", text: "Brakes, diagnostics, oil changes, A/C or whatever you do, with your real hours." },
      { title: "Appointment request form", text: "Name, phone, vehicle and the problem, emailed straight to you." },
      { title: "Service-area pages", text: "Pages for the nearby cities your customers come from, each written to be unique." },
      { title: "Shop photos", text: "Photos of your real shop and team, so people know what to expect." },
      { title: "Room for your registration number", text: "Show your California BAR registration number on the site if you have one." },
    ],
    faqs: [
      {
        question: "Can customers book a time online?",
        answer: "The build includes an appointment request form that emails you. You confirm the time with the customer.",
      },
      {
        question: "Can you list the brands I specialize in?",
        answer: "Yes, as long as it is true. We only list services and specialties you give us.",
      },
    ],
  },
];

/** Questions every trade page answers (facts from the Sitesinc offer only). */
export const COMMON_TRADE_FAQS = [
  {
    question: "How much does it cost?",
    answer:
      "The website build is $1,995 flat: $997.50 to start and $997.50 at launch. Pilot pricing is $1,495 for our first 3 clients. Monitoring is optional: 1st month free, then $129/mo.",
  },
  {
    question: "What areas do you serve?",
    answer: `We build websites for local businesses in ${SERVICE_AREA}.`,
  },
  {
    question: "How do I get started?",
    answer: `Call ${SITESINC_PHONE}, email ${SITESINC_EMAIL}, or send a request. Sending a request is not a purchase.`,
  },
];

export function getTrade(slug: string): Trade | undefined {
  return TRADES.find((t) => t.slug === slug);
}
