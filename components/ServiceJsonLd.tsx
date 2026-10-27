import content from "@/content.json";
import { buildServiceJsonLd, serializeJsonLd, type ServiceFaq } from "@/lib/service-jsonld";

export type { ServiceFaq };

export default function ServiceJsonLd({
  name,
  description,
  path,
  faqs = [],
}: {
  name: string;
  description: string;
  path: string;
  faqs?: ServiceFaq[];
}) {
  const payload = buildServiceJsonLd({ name, description, path, faqs, origin: content.seo.url });
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
    />
  );
}
