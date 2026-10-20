import content from "@/content.json";
import { faqItems } from "@/data/faq";

export default function SeoJsonLd() {
  const origin = content.seo.url;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
        "@id": `${origin}/#organization`,
        name: content.site.name,
        url: origin,
        email: content.footer.email,
        telephone: "+1-909-378-6404",
        logo: `${origin}/logo.png`,
        image: content.seo.image,
        priceRange: "$1,995",
        address: {
          "@type": "PostalAddress",
          streetAddress: content.footer.address.street,
          addressLocality: content.footer.address.city,
          addressRegion: content.footer.address.region,
          postalCode: content.footer.address.postalCode,
          addressCountry: content.footer.address.country,
        },
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
            "Website builds are $1,995. Pay 50% to start, 50% at launch. Monitored SEO is not included in the $1,995 build: 1st month free, then $129/mo.",
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
