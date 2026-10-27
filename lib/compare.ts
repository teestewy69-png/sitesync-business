/**
 * Fact-only competitor comparison data. Rules (Tony, 2026-10-27):
 *  - every competitor statement carries a source URL and the date we checked it
 *  - anything we could not verify directly is labeled "unverified" or left out
 *  - no claims about quality, reviews, or results; no invented statistics
 * Re-check the sources before editing numbers. Update CHECKED when you do.
 */

export const COMPARE_CHECKED = "October 27, 2026";
export const COMPARE_CHECKED_ISO = "2026-10-27";

export type CompareFact = {
  label: string;
  value: string;
  sourceUrl: string;
  sourceLabel: string;
  /** true when we could not read the source ourselves, so the page marks it unverified */
  unverified?: boolean;
};

export type CompareEntry = {
  slug: "hibu-alternative" | "thryv-alternative" | "web-com-alternative";
  name: string;
  /** H1 / title phrase */
  heading: string;
  title: string;
  description: string;
  intro: string;
  facts: CompareFact[];
  /** things to ask the company before signing, drawn from the facts above */
  askThem: string[];
  verifyNote?: string;
};

export const COMPARE: CompareEntry[] = [
  {
    slug: "hibu-alternative",
    name: "Hibu",
    heading: "A Hibu alternative for small businesses",
    title: "Hibu Alternative: Flat-Fee Website Instead of a Contract | Sitesinc",
    description:
      "Comparing Hibu with Sitesinc using published terms and sources. Hibu plans are custom with typical 6 to 12 month terms. Sitesinc builds your website for $1,995 flat, one time.",
    intro:
      "Hibu is a local marketing company that sells websites and ads. This page lists what Hibu publishes about pricing and cancellation, each with its source and the date we read it, next to how Sitesinc works.",
    facts: [
      {
        label: "Published pricing",
        value: "Hibu's pricing page describes custom pricing and does not list dollar amounts for its plans.",
        sourceUrl: "https://hibu.com/digital-marketing/pricing",
        sourceLabel: "hibu.com/digital-marketing/pricing",
      },
      {
        label: "Contract length (Hibu One)",
        value: "Hibu's pricing FAQ says contract terms typically range from 6 to 12 months, depending on the services in your custom plan. It also mentions an implementation fee for onboarding and setup, with no amount listed.",
        sourceUrl: "https://hibu.com/digital-marketing/pricing",
        sourceLabel: "hibu.com/digital-marketing/pricing (FAQ)",
      },
      {
        label: "Website package, monthly payment",
        value: "Hibu's General Terms say that if you pay for a Hibu website monthly, the term is 12 months, and canceling early may carry an early termination fee: $99 (Starter Websites), $299 (Starter Plus or Basic), $399 (Premium or Standard), $449 (Pro).",
        sourceUrl: "https://hibu.com/legal/general-terms",
        sourceLabel: "hibu.com/legal/general-terms",
      },
      {
        label: "How to cancel",
        value: "Hibu's General Terms say you may cancel by telephoning (877) 237-6120, Monday through Friday (except national holidays), 7:00 a.m. to 5:00 p.m. Central time.",
        sourceUrl: "https://hibu.com/legal/general-terms",
        sourceLabel: "hibu.com/legal/general-terms, section 21",
      },
    ],
    askThem: [
      "What is the total I will pay over the whole minimum term, including the implementation fee?",
      "Who is the registered owner of my domain name, and what does it take to move it?",
      "If I stop paying, what happens to my website?",
    ],
  },
  {
    slug: "thryv-alternative",
    name: "Thryv",
    heading: "A Thryv alternative for small businesses",
    title: "Thryv Alternative: Flat-Fee Website, Not a Monthly Plan | Sitesinc",
    description:
      "Comparing Thryv with Sitesinc using published pricing. Thryv's pricing page lists plans at $99 and $399 per month. Sitesinc builds your website for $1,995 flat, one time.",
    intro:
      "Thryv is a business software and marketing platform. This page lists what Thryv publishes on its pricing page, with the source and the date we read it, next to how Sitesinc works. Thryv sells software plus done-for-you marketing; Sitesinc does one thing, builds your website.",
    facts: [
      {
        label: "Starter plan",
        value: "$99 per month. The page lists an AI website builder, listings on 60+ directories, review management and trackable phone numbers.",
        sourceUrl: "https://www.thryv.com/pricing/",
        sourceLabel: "thryv.com/pricing",
      },
      {
        label: "Signature plan",
        value: "$399 per month, marked \"Recommended\" on the page.",
        sourceUrl: "https://www.thryv.com/pricing/",
        sourceLabel: "thryv.com/pricing",
      },
      {
        label: "Add-on marketing services (Boosts)",
        value: "Thryv describes Boosts as done-for-you ads, search, social and brand services that can be added to Signature and Custom plans. No Boost prices are shown on the page.",
        sourceUrl: "https://www.thryv.com/pricing/",
        sourceLabel: "thryv.com/pricing",
      },
      {
        label: "Contract length",
        value: "The pricing page does not state a contract length or cancellation terms. Ask Thryv for them in writing before you sign.",
        sourceUrl: "https://www.thryv.com/pricing/",
        sourceLabel: "thryv.com/pricing",
      },
    ],
    askThem: [
      "How long is the minimum term, and what does it cost to leave early?",
      "If I cancel, do I keep my website and my domain name?",
      "What do the add-on services cost per month, in writing?",
    ],
  },
  {
    slug: "web-com-alternative",
    name: "Web.com",
    heading: "A Web.com alternative for small businesses",
    title: "Web.com Alternative: Done-For-You Website, Flat Fee | Sitesinc",
    description:
      "Comparing Web.com website plans with Sitesinc. Web.com advertises first-year offer pricing that renews at a higher monthly rate. Sitesinc builds your website for $1,995 flat, one time.",
    intro:
      "Web.com (also branded Network Solutions) sells website-builder plans you set up yourself, plus design help. This page sticks to what we could confirm. Web.com's site blocked our automated reads, so we are explicit below about what is unverified.",
    facts: [
      {
        label: "Pricing structure",
        value: "Web.com's plan page shows a \"First Year Offer\" monthly price for each plan and a higher \"Renews at\" monthly price after the first year.",
        sourceUrl: "https://www.web.com/websites/build-a-website",
        sourceLabel: "web.com/websites/build-a-website",
        unverified: true,
      },
      {
        label: "Exact plan prices",
        value: "Not listed here. The numbers shown for Web.com differ between pages and review sites and change with the billing term you pick, and we could not read the live page ourselves. Check web.com for the current price before you compare.",
        sourceUrl: "https://www.web.com/pricing",
        sourceLabel: "web.com/pricing",
        unverified: true,
      },
      {
        label: "Renewal and cancellation",
        value: "Web.com's pricing page text says plans renew to the card on file for the term originally selected, and that you can cancel before the renewal date by chat or phone.",
        sourceUrl: "https://www.web.com/pricing",
        sourceLabel: "web.com/pricing",
        unverified: true,
      },
    ],
    askThem: [
      "What will I pay in month 13, and in month 25, for everything I add?",
      "Is design and setup included, or do I build the pages myself?",
      "If I cancel, can I take my website and domain name with me?",
    ],
    verifyNote:
      "Unverified means we read the information through a search-engine snapshot of Web.com's own pages on October 27, 2026 because Web.com blocked our direct reads. Treat it as a pointer, not a quote, and confirm on web.com.",
  },
];

export function getCompare(slug: CompareEntry["slug"]): CompareEntry {
  const entry = COMPARE.find((c) => c.slug === slug);
  if (!entry) throw new Error(`Unknown compare slug: ${slug}`);
  return entry;
}
