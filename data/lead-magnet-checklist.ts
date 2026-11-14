/**
 * Single source of truth for "The New Business Website Starter Checklist" —
 * the /start lead magnet. Consumed by lib/lead-magnet.ts (web page + welcome
 * email) and scripts/build-lead-magnet-pdf.mjs (the PDF in public/).
 * Plain erasable TypeScript so Node's type stripping can import it directly.
 */
export const LEAD_MAGNET_CHECKLIST = {
  title: "The New Business Website Starter Checklist",
  subtitle: "For people starting a business who know nothing about websites — yet.",
  intro:
    "You don't need to understand websites to end up with a good one. You need to make a handful of decisions, gather a short list of materials, and know which traps to step around. This is the same order we work through at SitesInc on every new build. Check things off as you go.",
  sections: [
    {
      heading: "1. Decide before you build",
      items: [
        "Settle on the exact business name you will use everywhere — sign, bank account, Google, website. Changing it later means redoing all of them.",
        "Pick a domain name (your .com address): short, easy to say out loud and spell, no hyphens or numbers if you can avoid them.",
        "Decide the website's one main job: phone calls, bookings, orders, or quote requests. Every page should push visitors toward that one action.",
        "Decide who will update the site after launch — you, an employee, or a service — before you decide how it gets built.",
      ],
    },
    {
      heading: "2. Gather your materials",
      items: [
        "Your logo, if you have one. If not, the exact business name in plain text is enough to start.",
        "Real photos: your work, your products, your shop or vehicle, you and your team. Real photos beat stock photos every time.",
        "A list of your services with plain-language descriptions and prices — or honest \"from\" prices where every job is different.",
        "Your hours, the cities or area you serve, and the one phone number you want customers to call.",
        "Licenses, certifications, or insurance details you are allowed to advertise.",
        "Any reviews or kind words from customers that you have permission to quote.",
      ],
    },
    {
      heading: "3. The pages a starter site needs",
      items: [
        "Home: what you do, who it's for, where you work, and one clear next step — call, book, or buy.",
        "Services: one section per service, written for the customer, not for other people in your trade.",
        "About: who you are and why you started. People buy from people.",
        "Contact: phone number, contact form, hours, service area, and a map if customers come to you.",
        "Answers page: the questions every customer asks — prices, how long it takes, where you travel, what happens first.",
      ],
    },
    {
      heading: "4. Google Business Profile basics",
      items: [
        "Claim your free Google Business Profile. It is how you show up on Google Maps and in \"near me\" searches.",
        "Use the same name, address, and phone number as your website — an exact match, down to the suite number.",
        "Pick the main category a customer would search for, not the fanciest description of your trade.",
        "Add your hours, photos, and services, and link the profile to your website.",
        "Ask happy customers to review you there, and reply to every review — good or bad.",
      ],
    },
    {
      heading: "5. Cost traps to avoid",
      items: [
        "Rent-a-website subscriptions: if the site disappears when you stop paying, you never owned anything. Ask, in writing, who owns the site and the domain.",
        "A site that does nothing: no phone number up top, no call button, no form, no way to buy. A pretty brochure nobody can act on is money parked, not money working.",
        "The domain registered in the builder's name or account. Register it in yours — it is your business's address on the internet.",
        "Add-ons you don't need yet: chat widgets, apps, extra pages. Start lean; you can add anything later.",
        "Surprise update fees: agree up front what a text or photo change costs, or whether you can do it yourself.",
      ],
    },
    {
      heading: "6. Launch day checklist",
      items: [
        "Open the site on your own phone. The call button works with one tap and the text is easy to read.",
        "Send yourself a test message through the contact form and confirm it actually arrives.",
        "Name, address, hours, and phone number are identical on the website, the Google profile, and your social pages.",
        "Search Google for your business name, and for your service plus your city. You should show up.",
        "You hold the logins: domain registrar, website admin, and the Google account — written down somewhere safe.",
        "Share the link where customers already see you: receipts, invoices, your vehicle, the shop window, and your social bios.",
      ],
    },
  ],
  closing:
    "That's the whole list. Work through it and you will be ahead of most new businesses before your site even exists. If you'd rather hand the website itself off: SitesInc builds real, working websites for new and small businesses — $1,995 flat, one time, no subscriptions. Email save@sitesinc.co or call (909) 323-1575.",
};
