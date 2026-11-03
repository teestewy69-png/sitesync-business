import content from "@/content.json";

/** LocalBusiness/Organization schema (phone + Laguna Beach address) for non-home pages. */
export default function OrgJsonLd() {
  const origin = content.seo.url;
  const { footer } = content;
  const data = {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
    "@id": `${origin}/#organization`,
    name: content.site.name,
    url: origin,
    email: footer.email,
    telephone: "+1-909-232-3536",
    logo: `${origin}/logo.png`,
    image: content.seo.image,
    priceRange: "$1,995",
    address: {
      "@type": "PostalAddress",
      streetAddress: footer.address.street,
      addressLocality: footer.address.city,
      addressRegion: footer.address.region,
      postalCode: footer.address.postalCode,
      addressCountry: footer.address.country,
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
