import type { FactoryPage } from "./types";

type Draft = Pick<FactoryPage, "title" | "metaDescription" | "headings" | "body">;

export const PAGE_DRAFTS: Record<string, Draft> = {
  "website-design": {
    title: "Small-business website design",
    metaDescription:
      "What a custom Sitesinc Next.js site includes for a shop that needs calls, not a template. One-time build. You own the code.",
    headings: [
      "What a small-business site has to do in the first 5 seconds",
      "Custom Next.js vs drag-and-drop",
      "What we actually build",
      "What we need from you",
      "When this is the wrong fit",
    ],
    body: `A small-business website has one job in the first five seconds: tell a stranger what you do, who it’s for, and how to reach you. If they have to hunt for a phone number or a price, they leave.

## What a small-business site has to do in the first 5 seconds

Show the offer. Show a real photo if you have one. Put the main action — call, book, or buy — where a thumb can hit it on a phone. Sitesinc builds that kind of page on purpose. We do not start from a marketplace template and hope the layout works.

## Custom Next.js vs drag-and-drop

Wix, Squarespace, and GoDaddy builders are fine if you want to rent a site and stay inside their editor. Sitesinc is a different product: a one-time Next.js + Tailwind build, hosted on Netlify, with the full code handed to you. You are not locked into a page builder. Any developer can open the repo later.

That also means we are not a “change this block yourself every Tuesday” tool. If you want weekly DIY edits in a visual editor, a builder may fit better.

## What we actually build

Website builds start at $1,995. Pay 50% to start and 50% at launch. The package includes a complete custom site, a choice of eight design directions, on-page SEO setup, a lead form, Stripe when you need checkout, hosting setup, one round of revisions, and a 5–7 business day turnaround after we have your content. Those numbers must match the homepage. We will not invent a different price here.

## What we need from you

Business name, what you sell, photos you want used, logo and colors if you have them, and the main goal (calls, bookings, or sales). We cannot start the clock until that package and payment are in.

## When this is the wrong fit

If you need a 40-page catalog, a custom app, or same-day copywriting from thin air, say so before you pay. We will tell you no rather than ship a thin site. If a rebuild is not the right move yet, read the redesign page first.

See current pricing on the homepage or the packages page. No ranking promises — a clearer site is the deliverable.`,
  },
  packages: {
    title: "Website packages",
    metaDescription:
      "Sitesinc website packages: builds starting at $1,995, 50% to start and 50% at launch, optional $129/mo monitoring. No required subscription.",
    headings: [
      "One-time build",
      "Optional care plan",
      "What is not a package",
      "How payment works",
    ],
    body: `Sitesinc sells a build, not a membership. Optional monitoring is extra and you can skip it.

## One-time build

Website builds start at $1,995. Pay 50% ($997.50) to start and 50% at launch. There is no long-term contract.

Included: custom Next.js + Tailwind site, eight design options, dark glossy UI, on-page SEO basics, lead capture, monetization placeholders, Stripe if you sell, code handoff, Netlify hosting setup, one revision round, 5–7 business days after content.

## Optional monitoring

$129/month. Completely optional. Your site runs without it. Cancel anytime. It covers monitoring, basic technical updates, and two to three small text or image changes a month. It is not unlimited design time and it is not ads management.

## What is not a package

We do not sell 20 “city + service” landing pages. We do not sell guaranteed rankings. We do not require you to keep paying to keep the site online if you take the code and host it yourself.

## How payment works

Pay in full through Stripe. After payment and onboarding details, we start. If you have questions before paying, email save@sitesinc.co. Prices on this page must match the homepage — if they ever drift, trust the homepage and tell us.

Twelve-month math, stated plainly: a $1,995 build plus optional $129/mo monitoring is $1,995 + $1,548 if you keep monitoring for a year. A $30–$50/mo builder is cheaper up front and more expensive if you stay for years — and you still do not own the code. Pick the model that matches how you want to operate.`,
  },
  "website-redesign": {
    title: "Website redesign",
    metaDescription:
      "When a Sitesinc rebuild is worth it — and when you should keep the current site. Honest redesign, not a scare pitch.",
    headings: [
      "Signs the current site is costing you calls",
      "What we keep",
      "What we replace",
      "When not to redesign",
    ],
    body: `A redesign is a rebuild, not a coat of paint. Sitesinc will tell you not to buy one if the current site already does the job.

## Signs the current site is costing you calls

People cannot find your phone number. The page is slow or broken on a phone. The copy talks about “solutions” instead of the service you actually sell. You cannot change hosting because the site lives inside a builder you do not control. Those are rebuild reasons.

A site that looks dated but still books work may only need better photos and a clearer headline. That is an edit, not a $1,995 project.

## What we keep

Your domain, your email, the facts about the business, and any photos or reviews you already own. We do not need to throw away a good Google Business Profile to ship a new front-end.

## What we replace

The template, the theme lock-in, and the layout that hides the CTA. We rebuild in Next.js, connect the domain, and hand you the repo. One revision pass after the first draft.

## When not to redesign

If you have no photos, no offer, and no time to answer onboarding questions, wait. If you only need a new logo, hire a designer. If you need a native app, we are the wrong shop.

Related reading: our blog posts on what a real small-business site needs and DIY vs done-for-you. This page will not claim a redesign raises revenue. It claims a clearer site is easier to use.`,
  },
  "seo-ready-websites": {
    title: "SEO-ready websites",
    metaDescription:
      "What SEO-ready means at Sitesinc: titles, one H1, sitemap, robots, canonicals, forms that notify someone. Indexing is not guaranteed.",
    headings: [
      "Titles, descriptions, and one H1",
      "Sitemap, robots, canonicals",
      "Internal links that help a human",
      "Forms that actually notify someone",
      "What SEO-ready does not mean",
    ],
    body: `SEO-ready at Sitesinc means the site launches with the on-page pieces Google’s public starter guide already asks for. It does not mean we rank you. Google decides what to crawl and index.

## Titles, descriptions, and one H1

Every public page should have a unique title, a meta description that matches the page, and one H1. We set those from your offer, not from a keyword-stuffed city list.

## Sitemap, robots, canonicals

A sitemap lists the URLs we want considered. Robots.txt should not block those URLs by accident. Canonical tags should point at the real URL. Staging and internal factory routes stay noindex.

## Internal links that help a human

We link related pages so a person can move from offer → packages → contact. We do not generate doorway pages for every town.

## Forms that actually notify someone

A lead form that writes to a store and emails save@sitesinc.co is part of SEO-ready in the practical sense: the site can complete a job. A pretty form that goes nowhere is a launch blocker.

## What SEO-ready does not mean

It does not mean page-one rankings, a set number of leads, or that submitting a sitemap indexes the URL. Search Console, when connected, is how we verify status. Until then we record “submitted” or “not submitted” and we do not mark pages indexed.

Google’s SEO Starter Guide is the public reference we align with. This factory case study tracks the same checklist on sitesinc.co itself.`,
  },
  "website-monitoring": {
    title: "Website monitoring",
    metaDescription:
      "Optional $129/mo Sitesinc monitoring: uptime, small edits, basic technical updates. The site works if you skip it.",
    headings: [
      "What monitoring means here",
      "What the $129/mo plan covers",
      "What you can skip",
    ],
    body: `After launch, the site is yours. Monitoring is optional paid help, not a hostage fee.

## What monitoring means here

We watch that the site responds, apply basic technical updates, and make a few small copy or image changes if you ask. That is the $129/month monitoring plan on the homepage pricing section.

## What the $129/mo plan covers

Technical updates and security basics, uptime/monitoring and basic fixes, and two to three small text or image updates per month. It does not include a new marketing campaign, a second full redesign, or unlimited same-day edits.

## What you can skip

You can host the handed-off repo yourself and never pay the care plan. The build is complete without it. If you want us to keep a key, buy the plan. If you want to cancel later, you still have the code.

This page will not scare you into a subscription. The homepage already says the care plan is optional. We repeat that here so a search for website monitoring does not hide the opt-out.`,
  },
  "for-local-service-businesses": {
    title: "For local service businesses",
    metaDescription:
      "How Sitesinc builds sites for barbers, contractors, food trucks, and coaches — one useful page, not a city doorway farm.",
    headings: [
      "What local service sites forget",
      "Barbers and personal care",
      "Contractors and trades",
      "Food trucks and hospitality",
      "Coaches and solo pros",
      "One factory, not 50 doorways",
    ],
    body: `Local service businesses do not need 40 city landing pages. They need a site that gets a real person to call.

## What local service sites forget

Tap-to-call. Hours. Service area in plain language. A price or a “from” price. A photo of the actual shop or truck. Those beat a stock skyline and a paragraph that starts with “In today’s digital world.”

## Barbers and personal care

Show the chair, the work, and how to book. Put the phone and Instagram where they belong. Do not bury the menu three taps deep.

## Contractors and trades

Lead with the emergency or the quote. License and insurance if you have them. Before/after photos you actually shot. A form that emails you the same hour.

## Food trucks and hospitality

Location and hours change. The site should say where you are this week, or send people to the profile that you update. The menu should be readable on a phone in the sun.

## Coaches and solo pros

One offer, one next step, proof that you have done the work. A 12-page “about my journey” site is optional. A clear booking path is not.

## One factory, not 50 doorways

Sitesinc will not clone this page for “barber in [city]” fifty times. If we ever add a second industry page, it will have new examples, not a find-and-replace. That is a quality rule, not a slogan.

The same factory that is rebuilding sitesinc.co — research, brief, human approval, staging, then publish — is the factory we run for a shop. Timeline is 5–7 business days after content, not 90 days of mystery. The 90-day case study on this domain is about proving the marketing system, not delaying your build.`,
  },
};

export function draftFromBrief(slug: string): Draft | null {
  return PAGE_DRAFTS[slug] || null;
}

export function wordCount(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}
