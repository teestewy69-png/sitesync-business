import { products } from "@/data/products";
import ShopHeader from "@/components/shop/ShopHeader";
import ProductCard from "@/components/shop/ProductCard";
import Link from "next/link";

export const metadata = {
  title: "Shop | Sitesync Business",
  description:
    "Affiliate product bundles and digital offers from Sitesync Business.",
};

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <ShopHeader />
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
            Shop
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Curated bundles &amp; partner offers.
          </h1>
          <p className="text-sm text-slate-400 sm:text-base">
            Digital kits, affiliate product bundles, and contact-only services.
            Add purchasable items to your cart, or reach out for consulting and
            jewelry.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          Need a full custom site instead?{" "}
          <Link href="/#pricing" className="text-brand-300 hover:underline">
            See website pricing
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
