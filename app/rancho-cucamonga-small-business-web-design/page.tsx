import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("rancho-cucamonga-small-business-web-design");
}

export default function Page() {
  return <PublishedOrNotFound slug="rancho-cucamonga-small-business-web-design" />;
}
