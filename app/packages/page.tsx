import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("packages");
}

export default function Page() {
  return <PublishedOrNotFound slug="packages" />;
}
