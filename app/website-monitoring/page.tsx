import PaymentOptions from "@/components/PaymentOptions";
import { factoryPageMetadata, PublishedOrNotFound } from "@/lib/factory/publish";

export async function generateMetadata() {
  return factoryPageMetadata("website-monitoring");
}

export default function Page() {
  return (
    <PublishedOrNotFound
      slug="website-monitoring"
      lead={
        <PaymentOptions
          location="website-monitoring"
          keys={["monitoring"]}
          heading="Start optional monitored SEO"
        />
      }
    />
  );
}
