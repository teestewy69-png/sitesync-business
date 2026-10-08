import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("website-monitoring");
}

export default function Page() {
  return <PublishedOrNotFound slug="website-monitoring" />;
}
