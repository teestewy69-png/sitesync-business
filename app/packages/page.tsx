import PaymentOptions from "@/components/PaymentOptions";
import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("packages");
}

export default function Page() {
  return (
    <PublishedOrNotFound
      slug="packages"
      lead={<PaymentOptions location="packages" heading="Pay the $1,995 website build" />}
    />
  );
}
