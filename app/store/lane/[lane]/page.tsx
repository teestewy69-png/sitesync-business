import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductImage from "@/components/siteflow/ProductImage";
import { getPublicProducts } from "@/data/products";
import { siteflowEnabled } from "@/lib/siteflow/flag";
import { getLane } from "@/lib/siteflow/lanes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lane: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!siteflowEnabled()) return { robots: { index: false, follow: false } };
  const { lane: laneSlug } = await params;
  const lane = getLane(laneSlug);
  if (!lane) return { robots: { index: false, follow: false } };
  return {
    title: `${lane.name} | Sitesinc`,
    description: `Sitesinc guides for ${lane.name}: ${getPublicProducts()
      .filter((p) => p.lane === lane.slug)
      .map((p) => p.name)
      .join(", ")}.`,
    // Deliberately unlisted like /store: no sitemap or navigation entry.
    robots: { index: false, follow: false },
  };
}

/**
 * Lane page: one audience grouping from lib/siteflow/lanes.ts, listing that
 * lane's public (listed + priced) products as cards that link to their
 * per-product landing pages, plus the lane's bundle card when the lane
 * carries one (the bundle is sold on Gumroad, not through the cart).
 * Self-gated on siteflowEnabled() exactly like app/store/page.tsx; unknown
 * lanes 404.
 */
export default async function LanePage({ params }: Props) {
  if (!siteflowEnabled()) notFound();
  const { lane: laneSlug } = await params;
  const lane = getLane(laneSlug);
  if (!lane) notFound();

  const products = getPublicProducts().filter((p) => p.lane === lane.slug);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-black px-6 py-16 text-white">
      <p className="text-sm">
        <Link href="/store" className="font-semibold text-brand-300 hover:underline">
          ← Back to the store
        </Link>
      </p>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">{lane.name}</h1>

      {lane.bundle ? (
        <section className="mt-10 rounded-2xl border border-brand-300/30 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-400">Bundle</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{lane.bundle.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{lane.bundle.note}</p>
          <p className="mt-2 text-lg font-semibold text-slate-50">{lane.bundle.price}</p>
          <p className="mt-4">
            <a
              href={lane.bundle.gumroadUrl}
              className="text-sm font-semibold text-brand-300 hover:underline"
            >
              Get the bundle on Gumroad
            </a>
          </p>
        </section>
      ) : null}

      {products.length === 0 ? (
        <p className="mt-8 text-base text-slate-300">Nothing is on sale in this lane right now.</p>
      ) : (
        <ul className="mt-10 grid gap-4">
          {products.map((product) => (
            <li
              key={product.slug}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex gap-4">
                <ProductImage
                  product={product}
                  className="h-20 w-20 shrink-0 rounded-2xl"
                  imgClassName="absolute inset-0 h-full w-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    {product.category}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    <Link href={`/store/${product.slug}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </h2>
                  {product.audience ? (
                    <p className="mt-1 text-sm text-slate-300">For {product.audience}.</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-400">{product.description}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-50">
                    {product.price}
                  </p>
                  <p className="mt-3 text-sm">
                    <Link
                      href={`/store/${product.slug}`}
                      className="font-semibold text-brand-300 hover:underline"
                    >
                      Details
                    </Link>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
