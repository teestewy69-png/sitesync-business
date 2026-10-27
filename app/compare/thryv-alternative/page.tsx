import type { Metadata } from "next";
import ComparePage from "@/components/ComparePage";
import { getCompare } from "@/lib/compare";
import { OG_IMAGE } from "@/lib/og-image";
import { LOCATIONS_ORIGIN } from "@/lib/locations";

const entry = getCompare("thryv-alternative");

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: `${LOCATIONS_ORIGIN}/compare/${entry.slug}` },
  robots: { index: true, follow: true },
  openGraph: { title: entry.title, description: entry.description, url: `${LOCATIONS_ORIGIN}/compare/${entry.slug}`, images: [OG_IMAGE] },
};

export default function Page() {
  return <ComparePage entry={entry} />;
}
