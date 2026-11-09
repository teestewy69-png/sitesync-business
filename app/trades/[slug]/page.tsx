import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OG_IMAGE } from "@/lib/og-image";
import TradeLanding from "@/components/TradeLanding";
import { TRADES, getTrade } from "@/data/trades";

export const dynamicParams = false;

export function generateStaticParams() {
  return TRADES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const trade = getTrade(slug);
  if (!trade) return {};
  const path = `/trades/${trade.slug}`;
  return {
    title: trade.metaTitle,
    description: trade.metaDescription,
    alternates: { canonical: path },
    openGraph: { title: trade.metaTitle, description: trade.metaDescription, url: path, images: [OG_IMAGE] },
  };
}

export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trade = getTrade(slug);
  if (!trade) notFound();
  return <TradeLanding trade={trade} />;
}
