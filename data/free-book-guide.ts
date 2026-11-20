/**
 * Single source of truth for "What Your Web Builder Won't Tell You" — the
 * /free-book lead magnet. Consumed by lib/free-book.ts (web page + welcome
 * email). The PDF copy in public/ is built from the same reviewed text via
 * the guide-library PDF pipeline.
 *
 * Text uses markdown-lite inline markers (**bold**, *italic*) which the
 * /free-book/guide page renders; guideText() in lib/free-book.ts strips them
 * for plain-text use. Plain erasable TypeScript so Node's type stripping can
 * import it directly.
 */
export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[] }
  | { type: "checklist"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "quote"; text: string };

export type GuideChapter = { heading: string; teaser: string; blocks: GuideBlock[] };

export const FREE_BOOK_GUIDE: {
  title: string;
  subtitle: string;
  brandLine: string;
  audience: string;
  honestNote: string;
  chapters: GuideChapter[];
  closing: string[];
} = {
  title: "What Your Web Builder Won't Tell You",
  subtitle: "The Hidden Costs of a Website — and How to Calculate the Real Price Before You Sign",
  brandLine: "A free guide from SitesInc (sitesinc.co)",
  audience:
    "For small business owners and startups who don't have a website yet — and don't want to overpay for one.",
  honestNote:
    "**An honest note before we start.** This guide is free, and it's published by a company that builds websites, so we have a point of view — you'll see it, stated plainly, in Chapter 6. Everything before that chapter is written to be useful no matter who you hire, including if you hire nobody and build it yourself. The prices in the worked examples are **illustrative** — real, typical-shaped numbers chosen so you can follow the arithmetic. Your quotes will differ. The method won't. That's the point of the guide: by the last page, you'll be able to take any quote anyone puts in front of you and calculate what it actually costs.",
  chapters: [
    {
      heading: "Chapter 1: The Sticker Price Is Not the Price",
      teaser: "Why the quoted price is never the real price — and the three questions that expose it",
      blocks: [
        {
          type: "p",
          text: "Ask three people what a website costs and you'll get three numbers that sound nothing alike: \"free,\" \"$500,\" \"$149 a month,\" \"$5,000.\" They can all be describing roughly the same website. The difference isn't the site. It's how the bill is sliced.",
        },
        { type: "p", text: "Website pricing hides the real number in three ways:" },
        {
          type: "p",
          text: "**1. The monthly slice.** A fee quoted per month sounds small because your brain files it next to a phone bill. But a website isn't a phone bill — you don't use it up each month. You keep it for years. So the only honest way to read a monthly price is to multiply it out. $149 a month sounds like a tank of gas. Over three years — a normal minimum life for a small business website — it's **$149 × 36 = $5,364**. Over five years it's $8,940. Nothing about the website changed. Only the math did.",
        },
        {
          type: "p",
          text: "**2. The missing line items.** The quoted price is usually the *build* price. It often doesn't include the domain renewal, the business email, the booking add-on, the per-change fees, or the \"maintenance plan\" that gets mentioned after you've signed. Each one is small. Stacked over three years, they're the difference between the price you agreed to and the price you paid. Chapter 2 lists every one of them, so none of them can surprise you.",
        },
        {
          type: "p",
          text: "**3. The ownership question nobody asks out loud.** This is the big one, and it's the thing builders least like to explain.",
        },
        { type: "h3", text: "What you're actually renting" },
        {
          type: "p",
          text: "In the subscription model — where an agency or platform charges you a monthly fee for \"your\" website — what you're usually renting is *permission to use* a website that lives on their system, under their control. The monthly fee covers hosting, upkeep, and their profit. That's a legitimate business model, and for some people it's the right choice (Chapter 4 says who, honestly).",
        },
        { type: "p", text: "But understand what renting means:" },
        {
          type: "list",
          items: [
            "**Stop paying, and the site goes away.** Not \"you lose support.\" The website itself — the thing your customers find on Google, the thing printed on your truck and your cards — can be switched off, because it was never transferred to you.",
            "**The domain may not be yours.** If the builder registered your business's domain name under *their* account, your name on the internet is their asset. Leaving means negotiating to get your own name back.",
            "**Your history doesn't move.** Years of Google ranking, reviews pointing at those pages, links from other sites — that value is attached to the site and domain. A renter who leaves often starts over at zero.",
          ],
        },
        {
          type: "p",
          text: "None of this makes subscription builders villains. It makes the monthly number incomplete. A rented website should be compared to a purchased one the way you'd compare renting a shop to buying one: rent is cheaper this month, every month, forever — and at the end you own nothing.",
        },
        { type: "h3", text: "The only fair comparison" },
        { type: "p", text: "Every quote — DIY, subscription, or one-time — can be reduced to the same three questions:" },
        {
          type: "list",
          items: [
            "**What do I pay in total over three years?** (Chapter 3 gives you the worksheet.)",
            "**What do I own at the end of it?**",
            "**What happens if I stop paying?**",
          ],
        },
        {
          type: "p",
          text: "A builder who answers all three clearly, in writing, is a builder you can work with. A builder who only wants to talk about the first month's price is telling you something. The rest of this guide teaches you to run those numbers yourself, so you never have to take anyone's word for it — including ours.",
        },
      ],
    },
    {
      heading: "Chapter 2: The Full Fee Stack, Line by Line",
      teaser: "All 14 charges that can hide in a website's true cost",
      blocks: [
        {
          type: "p",
          text: "Here is every charge that commonly appears in a website's true cost. Not every quote includes every line — that's exactly why you check them one by one. For each: what it is, what it typically looks like, and how it hides.",
        },
        {
          type: "p",
          text: "**1. The build / design fee.** The one-time cost of creating the site. Ranges from nothing (you do it yourself) to several thousand dollars. This is the number everyone advertises, because it's the number everyone compares. It's also, often, not the biggest number in the stack.",
        },
        {
          type: "p",
          text: "**2. Domain registration and renewals.** Your domain (yourbusiness.com) is rented from a registrar, never truly bought, and it renews **every year, forever, no matter who builds your site** — including if we build it. A .com typically runs about **$12–$20 a year** at a mainstream registrar. Small money. The danger isn't the price, it's the *account*: whoever's name the domain sits under controls it. Always register your domain in **your** name, on **your** account, with **your** email as the contact. This is the single most important line in this chapter.",
        },
        {
          type: "p",
          text: "**3. Hosting.** The rent for the server your site lives on. Small sites typically land somewhere in the $5–$50/month range when bought directly; subscription builders bundle it into their monthly fee (which is part of what you're renting). If a quote lists hosting separately *and* charges a monthly \"website fee,\" ask what each one covers — double-billing for the same server happens.",
        },
        {
          type: "p",
          text: "**4. SSL certificate.** The padlock in the browser address bar; without it, browsers warn visitors your site is \"not secure.\" Many hosts now include SSL free. Some builders still charge $50–$100 a year for it as a line item. Ask. If they're charging for SSL in 2026, ask what else in the quote is a padded legacy fee.",
        },
        {
          type: "p",
          text: "**5. Business email.** Email at your own domain (you@yourbusiness.com) usually comes from a separate service, commonly around $6–$8 per user per month. It's rarely included in a website quote, and it adds up: one mailbox at $7/month is $252 over three years. Not a scam — just a line almost nobody counts.",
        },
        {
          type: "p",
          text: "**6. SEO setup.** The work that helps Google understand and rank your site: page titles and descriptions, sitemap, indexing, local listings groundwork, the technical basics. Some builders include a real setup. Some charge a monthly \"SEO fee\" with no defined deliverables. Some do nothing and let you assume it happened. Ask what, specifically, is done, and when. (And know this: **nobody can guarantee a #1 ranking on Google.** Anyone who promises one is selling you something that does not exist. More on that in Chapter 6.)",
        },
        {
          type: "p",
          text: "**7. Analytics.** A tool — Google Analytics is the standard — that shows you how many people visit your site, where they came from, and what they did. Setting it up takes a competent builder a short time, and the tool itself is free. If a quote charges monthly for \"reporting,\" what you're buying is someone reading a free dashboard to you. You should have your own login to your analytics from day one. Your traffic data is your business data.",
        },
        {
          type: "p",
          text: "**8. Stock photos and content.** Images, and the writing on the pages. DIY builders discover this cost as their own evenings. Agencies may bill stock licenses or copywriting separately, or mark them up inside the build fee. Ask who writes the words. A beautiful site with placeholder-quality text converts nobody.",
        },
        {
          type: "p",
          text: "**9. Revision rounds.** Most build quotes include a set number of revision rounds — often two or three. Changes beyond that get billed. This is fair when it's stated up front. It hides when the quote says \"revisions included\" without saying how many.",
        },
        {
          type: "p",
          text: "**10. Per-change fees.** After launch, every \"can you just…\" — a new photo, a price change, a new page — may be a billable event under a subscription or maintenance arrangement, commonly priced like a service call. If you update your site often, this line can quietly outgrow the build fee. Ask for the rate card before you sign, not after your first change.",
        },
        {
          type: "p",
          text: "**11. \"Maintenance\" plans.** A monthly fee for updates, backups, security patches, and small fixes. Some are worth it — software does need updating. Many are a second rent layered on top of the first, covering work that takes minutes. Ask what the plan actually does each month, and what happens to your site if you drop the plan. If the honest answer is \"your site gets switched off,\" you're not buying maintenance. You're renting, and it should be priced as rent.",
        },
        {
          type: "p",
          text: "**12. Booking and e-commerce transaction fees.** If your site takes bookings or sells anything, expect payment processing on every transaction — around 3% per sale is the going shape of card processing — plus possible monthly fees for booking or store add-ons and apps. These aren't builder markups; they're the cost of taking money online. But they belong in your three-year math if selling is the point of the site.",
        },
        {
          type: "p",
          text: "**13. Renewal price jumps.** The introductory price is not the renewal price. Platforms and hosts routinely raise prices at renewal — a plan that starts cheap can renew at a meaningfully higher rate, and the increase arrives in an email most people don't read. When you calculate three years, use the *renewal* price for years two and three if you can find it. If you can't find it, that's information too.",
        },
        {
          type: "p",
          text: "**14. Exit and hostage costs.** The last line, and the one nobody puts in a quote: what does it cost to *leave*? Can you export your site's content? Do you get your domain transferred to you, free, on request? Is there a \"release fee,\" a buyout price for \"your\" site, or a contract term with early-termination charges? Some subscription arrangements price the buyout of your own website in the thousands. Ask before you sign, while you still have the leverage of not having signed.",
        },
        { type: "p", text: "**The stack, on one line each:**" },
        {
          type: "table",
          head: ["Fee", "One-time or recurring", "Who usually collects it"],
          rows: [
            ["Build / design", "One-time", "Builder or platform"],
            ["Domain renewal", "Yearly (~$12–$20 for .com)", "Registrar — in YOUR name"],
            ["Hosting", "Monthly", "Host or bundled in a subscription"],
            ["SSL certificate", "Yearly (often free)", "Host or builder"],
            ["Business email", "Monthly per mailbox", "Email provider"],
            ["SEO setup", "One-time or monthly", "Builder"],
            ["Analytics setup", "One-time (tool is free)", "Builder"],
            ["Photos / content", "One-time", "Stock library / writer / you"],
            ["Extra revisions", "Per round", "Builder"],
            ["Per-change fees", "Per change", "Builder / plan"],
            ["Maintenance plan", "Monthly", "Builder"],
            ["Transaction fees", "Per sale (~3%)", "Payment processor"],
            ["Renewal jumps", "At each renewal", "Platform / host"],
            ["Exit / buyout", "When you leave", "Builder — if the contract says so"],
          ],
        },
        {
          type: "p",
          text: "Fourteen possible lines. Most quotes show you two or three. Now you know the other eleven exist — and the next chapter turns them into one number.",
        },
      ],
    },
    {
      heading: "Chapter 3: The Calculation — Your Three-Year True Cost Worksheet",
      teaser: "The one-page worksheet that turns any quote into one honest number",
      blocks: [
        { type: "p", text: "Here's the whole method, and it fits on one page:" },
        {
          type: "quote",
          text: "**True cost = every one-time fee + (every monthly fee × 36) + (every yearly fee × 3) + the fees you'll trigger along the way.**",
        },
        {
          type: "p",
          text: "Three years is the right window. It's a normal minimum life for a small business website, it's long enough for \"cheap monthly\" to show its real size, and it's short enough that you're not pretending to predict the distant future.",
        },
        {
          type: "p",
          text: "Fill in one column per quote you're comparing. Use the quote's own numbers. Where a builder won't give you a number, write \"won't say\" — and treat that as a cost too, because an unknown recurring fee is a blank check.",
        },
        { type: "p", text: "**THE WORKSHEET**" },
        {
          type: "table",
          head: ["Line", "Quote A", "Quote B", "Quote C"],
          rows: [
            ["Build / design fee (one-time)", "$", "$", "$"],
            ["Setup / onboarding fee (one-time)", "$", "$", "$"],
            ["Stock photos / content (one-time)", "$", "$", "$"],
            ["Monthly website / platform fee × 36", "$", "$", "$"],
            ["Hosting, if separate, × 36", "$", "$", "$"],
            ["Business email (per mailbox × 36)", "$", "$", "$"],
            ["Maintenance plan × 36", "$", "$", "$"],
            ["Booking / store add-ons × 36", "$", "$", "$"],
            ["Domain: registration + 2 renewals (3 yrs)", "$", "$", "$"],
            ["SSL certificate × 3 years", "$", "$", "$"],
            ["Expected per-change fees (your guess × yrs)", "$", "$", "$"],
            ["**THREE-YEAR TOTAL**", "**$**", "**$**", "**$**"],
          ],
        },
        { type: "p", text: "Then answer, in writing, under each column:" },
        {
          type: "list",
          items: [
            "**What do I own at month 36?** (The site? The domain? Nothing?)",
            "**What happens if I stop paying at month 37?**",
            "**What's the exit cost if I want to leave in year one?**",
          ],
        },
        { type: "p", text: "**Three worksheet habits that change the answer:**" },
        {
          type: "list",
          items: [
            "**Use renewal prices for years two and three.** If the first year is a promo, the promo is not the price.",
            "**Count your own time on the DIY column.** Not in dollars — in a note at the bottom: \"plus ~40 of my evenings.\" Then decide what your evenings are worth. For some people the honest answer is \"nothing, I'd enjoy it.\" For most business owners it's the most expensive line on the page.",
            "**Don't let anyone fill this in for you verbally.** If a number matters, it can be written down. A builder who won't put the monthly fee, the term, and the exit terms in writing is asking you to sign the blank version.",
          ],
        },
        {
          type: "p",
          text: "**Comparing quotes that don't want to be compared.** Builders quote differently on purpose — one leads with a build fee, one with a monthly, one with a \"package.\" The worksheet defeats this by forcing every quote into the same three columns of arithmetic. Two traps survive the worksheet, so watch for them separately. First, **term length**: a low monthly fee locked into a 36-month contract can cost more than a higher fee you can cancel — multiply the monthly by the *contract term*, not just by 36, when the term is longer. Second, **the buyout**: if a subscription quote includes an option to own the site later, the buyout price is part of that quote's true cost if you ever intend to own anything. Add it to a second version of that column — \"cost if I stay\" and \"cost if I ever want to own it\" — and compare both. Quotes that look far apart often aren't, and quotes that look close often aren't either. The worksheet plus these two traps is the whole skill. Everything else is taste.",
        },
        {
          type: "p",
          text: "Now let's run the worksheet three times, with real-shaped numbers, so you can see the method work — and check our arithmetic while we do it.",
        },
      ],
    },
    {
      heading: "Chapter 4: Three Worked Comparisons",
      teaser: "DIY vs. subscription vs. one-time build, with the math shown",
      blocks: [
        {
          type: "p",
          text: "*Everything in this chapter is an **illustrative example** — typical-shaped numbers chosen to teach the method. They are not quotes, and they are not any specific company's prices. Your quotes will differ. Run yours through the Chapter 3 worksheet the same way. One number in this chapter is not illustrative: the one-time build price in Example C is SitesInc's actual price, because this is our guide and that's a fact we can state.*",
        },
        {
          type: "p",
          text: "*Each example assumes the same business: a local service company that needs a five-page website, business email, and online booking.*",
        },
        { type: "h3", text: "Example A — The DIY platform" },
        { type: "p", text: "You build it yourself on a do-it-yourself website platform, evenings and weekends." },
        {
          type: "table",
          head: ["Line", "Math", "3-year cost"],
          rows: [
            ["Platform plan", "$23/month × 36", "$828"],
            ["Domain (.com)", "$15/year × 3", "$45"],
            ["Business email (1 mailbox)", "$7/month × 36", "$252"],
            ["Booking add-on/app", "$10/month × 36", "$360"],
            ["Stock photo pack", "one-time", "$50"],
            ["**Total cash out**", "", "**$1,535**"],
          ],
        },
        {
          type: "p",
          text: "**Plus:** roughly 30–50 hours of your own time building and learning, and you are your own tech support forever.",
        },
        {
          type: "p",
          text: "**What you own at month 36:** your domain (if you registered it in your name — on DIY platforms, check). The site itself lives on the platform's system and generally can't be taken elsewhere; leave the platform and you rebuild.",
        },
        {
          type: "p",
          text: "**The honest verdict:** the cheapest cash number on this page, and it's not close. If your time is genuinely free and you enjoy this kind of work, DIY is a rational choice and no builder should tell you otherwise. The cost is real, though — it's just paid in evenings instead of dollars, and the result usually shows it: most owner-built sites are missing the SEO and analytics setup that makes a website earn its keep, because those are the parts you can't see.",
        },
        { type: "h3", text: "Example B — The subscription agency" },
        {
          type: "p",
          text: "An agency builds and runs everything, for a monthly fee, under a typical rent-your-website arrangement.",
        },
        {
          type: "table",
          head: ["Line", "Math", "3-year cost"],
          rows: [
            ["Setup fee", "one-time", "$499"],
            ["Monthly website fee (hosting, maintenance, changes bundled)", "$199/month × 36", "$7,164"],
            ["Domain", "bundled in the monthly fee", "$0"],
            ["Business email", "not included — bought separately, $7/month × 36", "$252"],
            ["**Total cash out**", "", "**$7,915**"],
          ],
        },
        {
          type: "p",
          text: "**What you own at month 36:** in this model, typically nothing. You've paid **$7,915** and the site, built on their system, stays theirs. Stop paying and the site comes down. (Some subscription builders do transfer ownership after a term or for a buyout — which is exactly why \"what do I own, and what's the buyout?\" are questions in Chapter 5.)",
        },
        {
          type: "p",
          text: "**The honest verdict:** look at what this route genuinely gives you, because it's not nothing. Your upfront cost is **$499, not $1,995** — for a business watching cash this quarter, that difference is real. There's a person to call. Changes are someone else's job. If the alternative is \"no website at all for two years while I save up,\" a subscription can be the right bridge. Just walk in knowing the three-year price of the bridge: by **the eighth month** (setup $499 + 8 × $199 = $2,091), you've already paid more than a one-time build costs outright — and unlike the build, the payments never end and the asset never becomes yours.",
        },
        { type: "h3", text: "Example C — The one-time build (SitesInc)" },
        { type: "p", text: "A builder charges once, builds the site, and hands it over." },
        {
          type: "table",
          head: ["Line", "Math", "3-year cost"],
          rows: [
            [
              "Website build — design, optimized SEO setup, monetization setup, indexed backlinks, Google Analytics setup",
              "one-time",
              "$1,995",
            ],
            ["Domain (.com) — registered in YOUR name at a registrar", "$15/year × 3", "$45"],
            ["Monthly website fee to the builder", "$0 — there isn't one", "$0"],
            ["Business email", "not included — bought separately if you want it, $7/month × 36", "$252"],
            ["**Total cash out**", "", "**$2,292**"],
          ],
        },
        {
          type: "p",
          text: "**What you own at month 36:** the website and the domain, full stop. There is no month 37 bill from the builder, and nothing to switch off.",
        },
        {
          type: "p",
          text: "**The honest verdict:** the highest upfront check of the three — **$1,995 on day one** is real money, and this guide won't pretend otherwise. A business that can't spare it shouldn't be shamed out of the DIY or subscription route. But over the window that matters, the one-time build costs **$2,292 against the subscription's $7,915** for a comparable result — and the gap widens every month after, because one column stops and the other doesn't. In year four, the one-time site costs you a domain renewal. The subscription costs another $2,388.",
        },
        { type: "h3", text: "The three totals, side by side" },
        {
          type: "table",
          head: ["Route", "Upfront", "3-year total", "Own at month 36"],
          rows: [
            ["DIY platform", "~$50 + first month + your time", "$1,535 + ~40 hrs", "Domain only; site stays on the platform"],
            ["Subscription agency", "$499", "$7,915", "Typically nothing"],
            ["One-time build", "$1,995", "$2,292", "The site and the domain"],
          ],
        },
        {
          type: "p",
          text: "Read the table the way it deserves: **each route wins something.** DIY wins on cash. Subscription wins on upfront cost and having someone to call. One-time wins on total cost and ownership. Anyone who tells you one route wins everything is selling, not explaining. Your job is to decide which win matters for your business — with the real totals in front of you, which is all this guide is trying to give you.",
        },
      ],
    },
    {
      heading: "Chapter 5: Red Flags — and the 10 Questions to Ask Any Builder",
      teaser: "The warning signs, plus ten questions to take to every sales call",
      blocks: [
        {
          type: "p",
          text: "You don't need to become a web expert to buy a website safely. You need to spot the shapes of a bad deal, and ask ten questions before you sign anything. Ask them of every builder — including us. A straight builder will answer all ten without blinking, in writing.",
        },
        { type: "h3", text: "Red flags in a website quote" },
        {
          type: "list",
          items: [
            "**The price is only ever stated per month.** If no one will say the three-year total out loud, they've done the math and prefer that you don't.",
            "**\"SEO included\" with nothing specified.** Included *what*? Which tasks, done when, verified how? Vague SEO is a line item you pay for and never receive.",
            "**A guaranteed Google ranking.** \"#1 on Google, guaranteed\" is not a thing anyone can sell you, because Google — not the builder — decides rankings. This is the single most reliable tell of a builder who will say anything to close.",
            "**The domain gets registered \"for you,\" under their account.** Convenient today, a hostage situation later. Your domain goes in your name, always, no exceptions.",
            "**No analytics access for you.** If you can't log in and see your own visitor numbers, you're being kept dependent on their reports — which will always say things are going great.",
            "**A contract with a term but no exit clause.** Long terms are negotiable business; silent exits are a trap. If leaving early costs thousands or costs you the site, that belongs on page one, not in the fine print.",
            "**Pressure to sign before the quote is itemized.** \"This price expires Friday\" is a sales technique, not a pricing policy. A real price survives the weekend.",
            "**They can't explain what happens when you stop paying.** The most important question in this guide. Evasiveness here is an answer.",
          ],
        },
        {
          type: "p",
          text: "**One more thing to read before you sign: the term and the renewal clause.** Website agreements commonly run 12 to 36 months, and many renew automatically for another full term unless you cancel inside a specific window — sometimes as narrow as 30 days before the anniversary, by a specific method, in writing. Missing that window can cost you another year of payments for a service you meant to leave. When you sign anything with a term, do two things the same day: write the cancellation deadline on a calendar you actually look at, and keep the cancellation instructions with the contract. This sounds like paperwork fussiness. It is, in fact, the difference between leaving a service and being renewed by one — and it costs nothing but ten minutes on day one.",
        },
        { type: "h3", text: "The 10 questions" },
        {
          type: "list",
          items: [
            "**What is the total cost over three years — every line, in writing?** (Run it through the Chapter 3 worksheet yourself anyway.)",
            "**Do I own my domain?** Registered in my name, on my account, with my email as the contact?",
            "**Do I own the website?** If not now, when — and what does it cost to own it?",
            "**What happens to my site if I stop paying or cancel?** Get the answer in the contract, not in a sales call.",
            "**What does year two cost?** Renewal prices, not launch prices.",
            "**What exactly is included in \"SEO\"?** Named tasks, not adjectives.",
            "**Do I get my own Google Analytics login?**",
            "**What do changes cost after launch?** The rate card, before you need it.",
            "**How many revision rounds are included in the build, and what do extra rounds cost?**",
            "**If I leave in a year, what do I walk away with — and what do I pay to leave?**",
          ],
        },
        {
          type: "p",
          text: "Print those. Take them to every sales call. The builder who welcomes the list is the builder the list was designed to find.",
        },
      ],
    },
    {
      heading: "Chapter 6: What SitesInc Includes — Stated Plainly",
      teaser: "Our offer, given the same treatment as everyone else's",
      blocks: [
        {
          type: "p",
          text: "This guide is published by SitesInc, so here's our offer with the same treatment we just gave everyone else's. No adjectives doing unpaid work; just the facts.",
        },
        {
          type: "p",
          text: "**The price: $1,995. One time.** No subscription, no monthly website bill to SitesInc, no setup fee on top of it.",
        },
        { type: "p", text: "**Included in that price:**" },
        {
          type: "list",
          items: [
            "**The website build** — your site, designed and built for your business.",
            "**Optimized SEO setup** — the technical and on-page groundwork that gives Google what it needs to understand and index your site: the unglamorous, essential layer most cheap builds skip.",
            "**Monetization setup** — the site is set up so it can make you money: the paths for customers to contact you, book, or buy, wired in from the start rather than bolted on later.",
            "**Indexed backlinks** — links pointing to your site from elsewhere on the web, submitted so search engines register them; part of how a new site starts getting found.",
            "**Google Analytics setup** — installed and working, so **you** can see your traffic: how many visitors, where they came from, what they looked at. Your numbers, visible to you.",
          ],
        },
        {
          type: "p",
          text: "**What it costs after that:** your domain renewal — roughly **$12–$20 a year** for a .com, paid to the registrar, because domains renew yearly no matter who builds your site. That's the honest universal cost, and any builder who tells you a website has *no* ongoing costs at all is leaving it out. If you want business email at your own domain, that's a separate service you'd buy from an email provider, like in the examples — it's not part of the $1,995, and we'd rather say so here than surprise you later.",
        },
        { type: "p", text: "**What we do not do — the no-fake-claims list:**" },
        {
          type: "list",
          items: [
            "**We do not guarantee a #1 ranking on Google.** Nobody can. Google decides rankings; anyone who promises you the top spot is promising something that isn't theirs to give.",
            "**We do not promise traffic or sales.** A website is a tool. Set up right, it's a tool that can be found and can convert visitors into calls and customers. Whether it does depends on your business, your market, and what you do with it.",
            "**We do not rent you your own website.** The point of the one-time model is the opposite of the subscription trap in Chapter 1: you pay once, and the site is yours — not a service that evaporates when a monthly payment stops.",
          ],
        },
        {
          type: "p",
          text: "**Who this fits:** a small business or startup that needs a real website, would rather pay once and own it than rent it forever, and wants the finding-you-on-Google groundwork done properly at build time instead of discovered missing a year later. That's our whole angle: get the little guy up and running — not stuck paying monthly for a website that does nothing.",
        },
        {
          type: "p",
          text: "If, after running your numbers, a different route fits your business better — your cash position says DIY, or you truly want a service that handles everything monthly — take it, with your eyes open. This guide will have done its job either way.",
        },
      ],
    },
    {
      heading: "Chapter 7: Before You Sign Anything — The One-Page Checklist",
      teaser: "The tear-out page to check before any contract gets signed",
      blocks: [
        {
          type: "p",
          text: "Tear this page out, metaphorically or literally, and don't sign a website contract until every box is honestly checked.",
        },
        { type: "h3", text: "The money" },
        {
          type: "checklist",
          items: [
            "I have the three-year total, in writing, for every quote I'm seriously considering.",
            "I ran each quote through the worksheet — monthly fees × 36, yearly fees × 3, one-time fees added.",
            "I used renewal prices for years two and three, not the promo price.",
            "I've counted the lines that weren't in the headline price: email, add-ons, per-change fees, extra revisions.",
          ],
        },
        { type: "h3", text: "The ownership" },
        {
          type: "checklist",
          items: [
            "My domain is (or will be) registered in **my** name, on **my** account.",
            "I know whether I own the website — and if not, when and for how much I could.",
            "I know, from the contract, what happens to my site if I stop paying.",
            "I know the exit cost of leaving in year one.",
          ],
        },
        { type: "h3", text: "The substance" },
        {
          type: "checklist",
          items: [
            "\"SEO\" in my quote names actual tasks, and none of them is a guaranteed ranking.",
            "I'll have my own Google Analytics login from day one.",
            "I know who writes the words and supplies the photos — and what that costs.",
            "I know the per-change rate card for after launch.",
          ],
        },
        { type: "h3", text: "The gut check" },
        {
          type: "checklist",
          items: [
            "Every answer above was given to me in writing, without pressure or a deadline.",
            "The builder answered the awkward questions — cancel, leave, own — as willingly as the easy ones.",
            "I chose this route knowing what the other routes genuinely do better.",
          ],
        },
        {
          type: "p",
          text: "If a box won't check, that's not a detail to fix after signing. It's the decision, arriving early. Websites are one of the first real investments a small business makes, and the difference between a good one and a bad one is rarely the design — it's whether you knew what you were buying. Now you do.",
        },
      ],
    },
  ],
  closing: [
    "*What Your Web Builder Won't Tell You* is a free guide from **SitesInc** — one-time website builds for small businesses and startups: **$1,995, no subscriptions**, with optimized SEO, monetization setup, indexed backlinks, and Google Analytics included. Find us at **sitesinc.co**.",
    "*Prices for third-party services and competing models in this guide are illustrative examples and typical ranges for teaching purposes; actual quotes vary. Domain renewal prices are set by registrars and change over time. Nothing in this guide is a guarantee of search ranking, traffic, or business results.*",
  ],
};
