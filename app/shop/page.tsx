import Link from "next/link";
import ProductCard from "@/components/shop/ProductCard";
import { anythingPurchasable, visibleProducts } from "@/lib/public-catalog";

export function generateMetadata() {
  const commerce = anythingPurchasable();
  return {
    title: commerce ? "Shop | Sitesinc" : "Other inquiries | Sitesinc",
    description: "Inquiry-only requests. Sitesinc's offer is website builds from $1,995 (50% to start, 50% at launch) and optional $129/month monitoring.",
    // Path A: the public offer is the website build + optional monitoring. This inquiry page stays reachable
    // (and its forms keep working) but is kept out of search and navigation while nothing here is for sale.
    ...(commerce ? {} : { robots: { index: false, follow: true } }),
  };
}

export default function ShopPage() {
  const catalog = visibleProducts();

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
          By inquiry only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Other inquiries
        </h1>
        <p className="text-base text-slate-400">
          Nothing on this page can be bought online. Send a note and we&apos;ll
          reply by email with details. Looking for a website? Sitesinc builds
          start at $1,995 (50% to start, 50% at launch), with optional
          monitoring at $129/month. Request one from the{" "}
          <Link href="/#pricing" className="text-brand-300 hover:underline">
            homepage
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}
