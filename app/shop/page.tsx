import { products } from "@/data/products";
import ProductCard from "@/components/shop/ProductCard";

export const metadata = {
  title: "Shop | Sitesync Business",
  description:
    "Affiliate product bundles and digital offers from Sitesync Business.",
};

export default function ShopPage() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 max-w-2xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">
          Storefront Demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Featured Products
        </h1>
        <p className="text-sm text-slate-400 sm:text-base">
          Digital kits, affiliate bundles, and contact-only services. Browse
          the catalog, open a product, or add purchasable items to your cart.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </section>
  );
}
