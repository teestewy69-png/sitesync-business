import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/siteflow/AddToCartButton";
import ProductImage from "@/components/siteflow/ProductImage";
import { getProduct, getPublicProducts } from "@/data/products";
import { siteflowEnabled } from "@/lib/siteflow/flag";
import { getLane } from "@/lib/siteflow/lanes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!siteflowEnabled()) return { robots: { index: false, follow: false } };
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { robots: { index: false, follow: false } };
  return {
    title: `${product.name} | Sitesinc`,
    description: product.description,
    // Deliberately unlisted like /store: no sitemap or navigation entry.
    robots: { index: false, follow: false },
  };
}

/**
 * Per-product landing page. Only public catalog entries exist here: getProduct
 * returns undefined for unlisted, unpriced, retired and unknown slugs, and those
 * 404. Self-gated on siteflowEnabled() exactly like app/store/page.tsx (the
 * /store layout gates too). Facts (audience, includes, Gumroad link, lane) come
 * from data/products.ts + lib/siteflow/lanes.ts — nothing is invented here.
 */
export default async function ProductLandingPage({ params }: Props) {
  if (!siteflowEnabled()) notFound();
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const lane = getLane(product.lane);
  const siblings = lane
    ? getPublicProducts().filter((p) => p.lane === lane.slug && p.slug !== product.slug)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-black px-6 py-16 text-white">
      <p className="text-sm">
        <Link href="/store" className="font-semibold text-brand-300 hover:underline">
          ← Back to the store
        </Link>
      </p>

      <div className="mt-8 flex gap-5">
        <ProductImage
          product={product}
          className="h-28 w-28 shrink-0 rounded-2xl"
          imgClassName="absolute inset-0 h-full w-full object-cover"
        />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            {product.category}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
          {product.audience ? (
            <p className="mt-2 text-base text-slate-300">For {product.audience}.</p>
          ) : null}
          <p className="mt-3 text-2xl font-semibold text-slate-50">{product.price}</p>
          {product.disclosure ? (
            <p className="mt-1 text-xs text-amber-200" data-disclosure="billing">
              {product.disclosure}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-8 text-base leading-relaxed text-slate-300">{product.description}</p>

      {product.includes?.length ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">What&apos;s inside</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-slate-300">
            {product.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {product.fulfillmentInputs?.length ? (
        <p className="mt-6 text-sm text-slate-400">
          At checkout we ask for{" "}
          {product.fulfillmentInputs.map((field) => field.label.toLowerCase()).join(", ")}
          , so we can prepare it for your business.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <AddToCartButton slug={product.slug} />
        {product.gumroadUrl ? (
          <a
            href={product.gumroadUrl}
            className="text-sm font-semibold text-brand-300 hover:underline"
          >
            Also available on Gumroad
          </a>
        ) : null}
      </div>

      {lane && siblings.length ? (
        <footer className="mt-16 border-t border-white/10 pt-8">
          <h2 className="text-lg font-semibold text-white">
            More in{" "}
            <Link href={`/store/lane/${lane.slug}`} className="text-brand-300 hover:underline">
              {lane.name}
            </Link>
          </h2>
          <ul className="mt-4 grid gap-3">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/store/${sibling.slug}`}
                  className="font-semibold text-brand-300 hover:underline"
                >
                  {sibling.name}
                </Link>{" "}
                <span className="text-sm text-slate-400">— {sibling.price}</span>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </main>
  );
}
