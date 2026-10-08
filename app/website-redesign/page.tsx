import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("website-redesign");
}

export default function Page() {
  return <PublishedOrNotFound slug="website-redesign" />;
}
