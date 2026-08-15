import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, products } from "@/data/products";
import ShopHeader from "@/components/shop/ShopHeader";
import ProductDetail from "@/components/shop/ProductDetail";

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
    <main className="min-h-screen bg-black text-white">
      <ShopHeader />
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <Link
          href="/shop"
          className="mb-6 inline-flex text-xs text-brand-300 hover:underline"
        >
          ← Back to shop
        </Link>
        <ProductDetail product={product} />
      </div>
    </main>
  );
}
