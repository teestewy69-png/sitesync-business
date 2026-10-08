import content from "@/content.json";
import { faqItems } from "@/data/faq";

export default function SeoJsonLd() {
  const origin = content.seo.url;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: content.site.name,
        url: origin,
        email: content.footer.email,
        logo: content.seo.image,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: content.seo.siteName,
        url: origin,
        publisher: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "Service",
        "@id": `${origin}/#service`,
        name: "Website Factory",
        serviceType: "Website design and development",
        provider: { "@id": `${origin}/#organization` },
        areaServed: "US",
        offers: {
          "@type": "Offer",
          price: "1995",
          priceCurrency: "USD",
          description:
            "Website builds starting at $1,995. Pay 50% to start, 50% at launch. Optional monitoring $129/month.",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${origin}/#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
