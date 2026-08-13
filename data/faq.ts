export type FaqItem = {
  question: string;
  answer: string;
};

export const faqItems: FaqItem[] = [
  {
    question: "Do I really own my website?",
    answer:
      "Yes. Once your website is complete and paid for, you own everything—the code, design, and content. We hand over the full project codebase so you can host, edit, or expand it however you like in the future.",
  },
  {
    question: "What platform is my site built on?",
    answer:
      "We build your site with Next.js (a modern React framework) and Tailwind CSS, hosted on Netlify. This is the same modern tech stack used by many serious online businesses that care about speed, SEO, and flexibility.",
  },
  {
    question: "Can I edit the site content myself later?",
    answer:
      "Yes, if you or your developer are comfortable editing basic code files. Your content lives in a simple configuration file (like content.json). You can adjust text, services, and basic info directly in that file, then redeploy. We also provide a short walkthrough video showing exactly where to change things. If you don\u2019t want to touch code at all, you can use our optional maintenance service and we\u2019ll handle updates for you.",
  },
  {
    question: "Is hosting included?",
    answer:
      "Yes. We include free hosting on Netlify with every website we build. That gives you fast global delivery, SSL (https), and a reliable deployment setup. You\u2019re not locked in, though\u2014because you own your code, you can move your site to any other compatible host whenever you want.",
  },
  {
    question: "How long will it take to get my website?",
    answer:
      "Once we have your content (logo, text, images, and basic info), your website is typically ready in 5\u20137 business days. You\u2019ll get a preview, one round of revisions, and then we launch.",
  },
  {
    question: "I already have a domain. Can you use it?",
    answer:
      "Yes. If you already own a domain (like yourbusiness.com), we\u2019ll connect your new website to it. We\u2019ll guide you through the DNS changes or coordinate with your domain provider so your new site goes live on your existing domain.",
  },
  {
    question: "How much does it cost? Are there any subscriptions?",
    answer:
      "The complete website build is a one-time fee of $1,499. There is no required subscription or builder lock-in. We also offer an optional maintenance plan for $125/month if you want us to handle ongoing tech updates and small content changes.",
  },
  {
    question: "What\u2019s the 50% off deal for the first 10 businesses?",
    answer:
      "To launch this service, we\u2019re giving the first 10 businesses a 50% discount on the full website build. Regular price is $1,499, but the first 10 who reserve and pay lock in a total of $749.50. After those 10 spots are taken, the price returns to $1,499.",
  },
  {
    question: "What\u2019s included in the $1,499 build?",
    answer:
      "Your one-time fee includes: a custom site built on one of 8 ultra-modern dark designs, full Next.js + Tailwind development, on-page SEO basics, funnel setup (lead capture and email signup), Stripe integration, monetization placeholders (digital products and affiliate areas), Netlify hosting setup, domain connection, a 5\u20137 business day turnaround after receiving your content, and one round of revisions.",
  },
  {
    question: "What do you need from me to start?",
    answer:
      "After you reserve your spot and pay, we send you a short onboarding form where you provide your business name, services, main offers, logo, brand colors (if you have them), photos, and domain info. Once that\u2019s submitted, we start building and your 5\u20137 business day timeline begins.",
  },
];
