import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductActions from "@/components/shop/ProductActions";
import { anythingPurchasable, canBuyOnline, visibleProduct, visibleProducts } from "@/lib/public-catalog";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return visibleProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = visibleProduct(slug);
  if (!product) return { title: "Not found | Sitesinc", robots: { index: false, follow: false } };
  return {
    title: `${product.name} | Sitesinc`,
    description: product.description,
    // Inquiry-only pages stay out of search while nothing is for sale (Path A); the form keeps working.
    ...(anythingPurchasable() ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = visibleProduct(slug);
  if (!product) notFound();
  const buyable = canBuyOnline(product);

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <Link
        href="/shop"
        className="mb-8 inline-flex text-xs font-medium text-brand-300 transition hover:text-brand-200 hover:underline"
      >
        ← Back to inquiries
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <div className="relative aspect-[4/3] min-h-[280px] overflow-hidden rounded-[28px] border border-white/10 bg-surface">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
            priority
          />
          {product.badge ? (
            <span className="absolute top-5 left-5 rounded-full bg-brand-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/40 backdrop-blur">
              {product.badge}
            </span>
          ) : null}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              {product.category}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {product.name}
            </h1>
          </div>

          <div className="flex items-baseline gap-3">
            {product.contactOnly ? (
              <span className="text-xl font-semibold text-brand-300">
                Contact for pricing
              </span>
            ) : (
              <span className="text-3xl font-semibold text-white">
                {product.price}
              </span>
            )}
          </div>

          <p className="text-base leading-relaxed text-slate-400">
            {product.description}
          </p>

          {product.contactOnly ? <ProductActions product={product} /> : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-white">
              Product details
            </h2>
            <ul className="mt-3 space-y-2 text-base text-slate-400">
              <li>
                <span className="text-slate-400">Category:</span>{" "}
                {product.category}
              </li>
              <li>
                <span className="text-slate-400">Fulfillment:</span>{" "}
                {product.contactOnly
                  ? "Contact / custom quote"
                  : product.kind === "subscription"
                    ? `Subscription (${product.interval === "year" ? "yearly" : "monthly"}, cancel anytime)`
                    : product.deliverable?.type === "manual"
                      ? "Service, set up by Sitesinc after payment"
                      : "Digital download, emailed after payment"}
              </li>
            </ul>
          </div>

          {buyable ? <ProductActions product={product} /> : null}
        </div>
      </div>
    </section>
  );
}
