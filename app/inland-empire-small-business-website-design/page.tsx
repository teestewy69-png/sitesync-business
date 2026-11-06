import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("inland-empire-small-business-website-design");
}

export default function Page() {
  return <PublishedOrNotFound slug="inland-empire-small-business-website-design" />;
}
