import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FactoryArticle } from "@/lib/factory/publish";
import { readWorkspace } from "@/lib/factory/workspace";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: "Staging preview",
};

export default async function StagingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await readWorkspace();
  const page = workspace.pages.find((item) => item.slug === slug);
  if (!page || !page.body.trim()) notFound();
  return (
    <main className="min-h-screen bg-black text-white">
      <FactoryArticle page={page} staged />
    </main>
  );
}
