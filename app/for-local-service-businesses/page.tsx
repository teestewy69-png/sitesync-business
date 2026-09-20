import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("for-local-service-businesses");
}

export default function Page() {
  return <PublishedOrNotFound slug="for-local-service-businesses" />;
}
