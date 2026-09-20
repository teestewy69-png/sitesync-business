import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("seo-ready-websites");
}

export default function Page() {
  return <PublishedOrNotFound slug="seo-ready-websites" />;
}
