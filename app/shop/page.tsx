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
            <article
              key={product.slug}
              className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-brand-400/40"
            >
              {product.badge ? (
                <span className="absolute top-4 right-4 rounded-full bg-brand-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40">
                  {product.badge}
                </span>
              ) : null}

              <p className="pr-20 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                {product.category}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
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
                  <span className="text-base font-semibold text-brand-300">
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

              <div className="mt-4">
                {product.contactOnly ? (
                  <a
                    href="mailto:save@sitesinc.co"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-brand-400/50"
                  >
                    Contact us
                  </a>
                ) : (
                  <Link
                    href={`/shop/product/${product.slug}`}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
                  >
                    View product
                  </Link>
                )}
              </div>
            </article>
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
