import ProductCard from "@/components/shop/ProductCard";
import { getPublicProducts } from "@/data/products";

export const metadata = {
  title: "Shop | Sitesinc",
  description: "Affiliate product bundles from Sitesinc. Website builds are requested separately and are not sold here.",
};

export default function ShopPage() {
  const catalog = getPublicProducts();

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
          Storefront
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Featured Products
        </h1>
        <p className="text-base text-slate-400">
          Affiliate bundles and contact-only services. Website builds are not sold
          in this shop. Request a Sitesinc website from the homepage form — that
          is a request, not a purchase.
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