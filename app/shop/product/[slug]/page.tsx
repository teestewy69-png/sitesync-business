import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/shop/ProductDetail";
import { getProduct, products } from "@/data/products";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product | Sitesync Business" };
  return {
    title: `${product.name} | Sitesync Shop`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <Link
        href="/shop"
        className="mb-8 inline-flex text-xs font-medium text-brand-300 transition hover:text-brand-200 hover:underline"
      >
        ← Back to shop
      </Link>
      <ProductDetail product={product} />
    </section>
  );
}
