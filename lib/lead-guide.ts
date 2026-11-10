/**
 * Free lead guide: "7 things your website needs to make the phone ring".
 *
 * Offered in the exit-intent pop-up (components/ExitIntentCapture.tsx); the email goes through the existing
 * /api/subscribe lead capture with offer=GUIDE_OFFER_ID. Readable at /free-guide and downloadable as text at
 * /free-guide/download. Honest by design: no ranking promises, no statistics, no invented results.
 */
import content from "@/content.json";

export const GUIDE_OFFER_ID = "phone-ring-guide";
export const GUIDE_PATH = "/free-guide";
export const GUIDE_DOWNLOAD_PATH = "/free-guide/download";
export const GUIDE_TITLE = "7 things your website needs to make the phone ring";
export const GUIDE_SUBTITLE =
  "A plain-English checklist for local service businesses. Open your own website on your phone and go through it.";

export type GuideItem = { title: string; why: string; checks: string[] };

export const GUIDE_INTRO = [
  "Most people who find a local business online decide in a few seconds whether to call. This checklist covers the basics that make calling easy.",
  "None of this is a trick, and none of it guarantees a Google ranking or a number of calls. These are simply the things a customer looks for before they pick up the phone.",
];

export const GUIDE_ITEMS: GuideItem[] = [
  {
    title: "Your phone number at the top of every page, and it works with one tap",
    why: "Someone with a leaking pipe or a broken AC isn't going to hunt for your number. On a phone, they want to tap it and call.",
    checks: [
      "The number is in the header of every page, not just the Contact page.",
      "On a phone, tapping the number starts a call.",
      "It's the same number that's on your Google Business Profile and your truck.",
    ],
  },
  {
    title: "A headline that says what you do and where",
    why: "\"Welcome to our website\" tells a visitor nothing. \"Water heater repair in Riverside\" tells them they're in the right place.",
    checks: [
      "A stranger can tell what you do, where you work and how to reach you within a few seconds.",
      "Your main service and your main town are in the headline or right under it.",
    ],
  },
  {
    title: "A page (or a clear section) for each main job you do",
    why: "People search for the job, not the company. Someone looking for \"drain cleaning\" wants to land on drain cleaning, not a long list of everything.",
    checks: [
      "Your 3-5 most common jobs each have their own page or section.",
      "Each one says, in your own words, what's included and what the customer can expect.",
      "Prices or \"from\" prices are listed if you're comfortable sharing them. If not, say how quotes work.",
    ],
  },
  {
    title: "The towns you actually serve, named plainly",
    why: "Customers want to know you come to them. Search engines also need to see where you work.",
    checks: [
      "Your service area lists real towns you go to.",
      "If you make a page for a town, it's written for that town. Copy-paste pages with only the town name swapped help no one.",
    ],
  },
  {
    title: "Real proof: reviews, your own photos and your license",
    why: "People hire who they trust. Real proof beats any claim you can write about yourself.",
    checks: [
      "A few real reviews with first names, shared with the customer's OK.",
      "Photos of your own work, crew and trucks instead of stock photos.",
      "Your license number, if your trade requires one, and whether you're insured.",
      "No fake or bought reviews, ever.",
    ],
  },
  {
    title: "A short contact form that reaches you, and says what happens next",
    why: "A form that goes to an inbox nobody checks is worse than no form at all.",
    checks: [
      "You've sent a test message yourself and it arrived where you'll see it.",
      "The form asks only what you need: name, phone or email, and what the job is.",
      "It tells people what happens next, and only promises a call-back time you'll actually keep.",
    ],
  },
  {
    title: "The same details on Google and the main listings",
    why: "Customers check Google Maps, Yelp and Apple Maps. If your name, number or hours don't match, they wonder whether you're still in business.",
    checks: [
      "Your Google Business Profile is claimed and verified.",
      "Bing Places, Apple Business Connect and Yelp are claimed too (all free).",
      "Your business name, phone and address are written exactly the same everywhere.",
    ],
  },
];

export const GUIDE_QUICK_TEST = [
  "Take out your phone and turn off Wi-Fi.",
  "Search for your business and open your website.",
  "Can you tell what you do and where within a few seconds?",
  "Can you call with one tap?",
  "Did it load without making you wait?",
];

function contactLine() {
  const { footer } = content as { footer: { phone: string; email?: string } };
  return `Questions? Call Sitesinc at ${footer.phone}${footer.email ? ` or email ${footer.email}` : ""}.`;
}

function mailingAddress() {
  const a = (content as { footer: { address: { street: string; city: string; region: string; postalCode: string } } }).footer.address;
  return `Sitesinc · ${a.street}, ${a.city}, ${a.region} ${a.postalCode}`;
}

/** Plain-text version: the email body and the /free-guide/download file. */
export function guidePlainText(origin = "https://sitesinc.co"): string {
  const lines: string[] = [
    GUIDE_TITLE.toUpperCase(),
    GUIDE_SUBTITLE,
    "",
    ...GUIDE_INTRO.flatMap((p) => [p, ""]),
  ];
  GUIDE_ITEMS.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title.toUpperCase()}`, item.why, ...item.checks.map((c) => `[ ] ${c}`), "");
  });
  lines.push("2-MINUTE TEST", ...GUIDE_QUICK_TEST.map((t) => `- ${t}`), "");
  lines.push(
    `Read it online: ${origin}${GUIDE_PATH}`,
    `Want a second pair of eyes? Get a free audit of your site: ${origin}/free-website-audit`,
    contactLine(),
    "",
    mailingAddress()
  );
  return lines.join("\n");
}

/** Email the visitor gets after asking for the guide in the exit-intent pop-up. */
export function guideEmailText(origin = "https://sitesinc.co"): string {
  return [
    "Hi,",
    "",
    "Here's the free guide you asked for. It's short. Go through it with your website open on your phone.",
    "",
    guidePlainText(origin),
    "",
    "You're getting this because you asked for the guide on sitesinc.co. Reply \"unsubscribe\" and we won't email you again.",
  ].join("\n");
}
