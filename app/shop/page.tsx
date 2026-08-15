import Image from "next/image";
import Link from "next/link";
import { products } from "@/data/products";
import ShopHeader from "@/components/shop/ShopHeader";

export const metadata = {
  title: "Shop | Sitesync Business",
  description:
    "Affiliate product bundles and digital offers from Sitesync Business.",
};

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <ShopHeader />
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
            <article
              key={product.slug}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-brand-400/50"
            >
              <Link
                href={`/shop/product/${product.slug}`}
                className="relative block aspect-[4/3] overflow-hidden border-b border-white/10 bg-surface"
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                {product.badge ? (
                  <span className="absolute top-3 right-3 rounded-full bg-brand-500/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40 backdrop-blur">
                    {product.badge}
                  </span>
                ) : null}
              </Link>

              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                  {product.category}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  <Link
                    href={`/shop/product/${product.slug}`}
                    className="hover:text-brand-200"
                  >
                    {product.name}
                  </Link>
                </h2>
                <p className="mt-2 flex-1 text-sm text-slate-400">
                  {product.description}
                </p>

                <div className="mt-4 flex items-baseline gap-2">
                  {product.contactOnly ? (
                    <span className="text-sm font-semibold text-brand-300">
                      Contact for pricing
                    </span>
                  ) : (
                    <>
                      <span className="text-xl font-semibold text-white">
                        {product.price}
                      </span>
                      {product.regularPrice ? (
                        <span className="text-sm text-slate-500 line-through">
                          {product.regularPrice}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                <Link
                  href={`/shop/product/${product.slug}`}
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
                >
                  View Product
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
