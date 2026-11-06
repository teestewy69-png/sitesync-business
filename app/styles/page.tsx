import type { Metadata } from "next";
import Link from "next/link";
import OrgJsonLd from "@/components/OrgJsonLd";
import SitePage from "@/components/SitePage";
import StylePreviewCard from "@/components/StylePreviewCard";
import { DESIGN_STYLES } from "@/lib/design-styles";
import { OG_IMAGE } from "@/lib/og-image";

const title = "8 Website Layouts | Sitesinc";
const description =
  "See all eight Sitesinc website layouts on one public page. Same $1,995 live offer, eight structures — pick the look before you start the build.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/styles" },
  openGraph: {
    title,
    description,
    url: "/styles",
    images: [OG_IMAGE],
  },
};

export default function StylesPage() {
  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          8 layouts
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Pick the layout. We build the site.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-300">
          These are the eight layouts Sitesinc ships — the same live offer you see
          on sitesinc.co, not private client demos. Open any card for a larger
          preview, then start the $1,995 build.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          <Link href="/packages" className="font-medium text-brand-300 hover:underline">
            Packages and pricing
          </Link>
          {" · "}
          <Link href="/contact" className="font-medium text-brand-300 hover:underline">
            Contact
          </Link>
          {" · "}
          <Link href="/#checklist" className="font-medium text-brand-300 hover:underline">
            Request a build
          </Link>
        </p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {DESIGN_STYLES.map((style) => (
            <li key={style.id}>
              <StylePreviewCard style={style} />
            </li>
          ))}
        </ul>
      </section>
    </SitePage>
  );
}
