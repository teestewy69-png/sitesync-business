import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("affordable-small-business-website-1995");
}

export default function Page() {
  return <PublishedOrNotFound slug="affordable-small-business-website-1995" />;
}
