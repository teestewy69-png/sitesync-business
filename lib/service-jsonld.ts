import { PATH_A_OFFER } from "@/lib/offer-copy";

export type ServiceFaq = { question: string; answer: string };

/** Service + Offer JSON-LD, plus FAQPage only when the page actually has FAQs. */
export function buildServiceJsonLd({
  name,
  description,
  path,
  faqs = [],
  origin = "https://sitesinc.co",
}: {
  name: string;
  description: string;
  path: string;
  faqs?: ServiceFaq[];
  origin?: string;
}): Record<string, unknown> {
  const url = `${origin}${path === "/" ? "" : path}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Service",
      "@id": `${url}#service`,
      name,
      serviceType: "Website design and development",
      description,
      url,
      provider: { "@id": `${origin}/#organization` },
      areaServed: "US",
      offers: {
        "@type": "Offer",
        "@id": `${url}#offer`,
        url,
        price: "1995",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: `Website builds are ${PATH_A_OFFER.buildFrom}. Pay 50% to start, 50% at launch. Monitored SEO is not included in the $1,995 build: ${PATH_A_OFFER.monitoring}.`,
      },
    },
  ];
  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }
  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
