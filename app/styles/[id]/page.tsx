import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MiniSiteFrame from "@/components/MiniSiteFrame";
import OrgJsonLd from "@/components/OrgJsonLd";
import SitePage from "@/components/SitePage";
import {
  DESIGN_STYLES,
  SITESINC_SITE,
  getDesignStyle,
  isDesignStyleId,
} from "@/lib/design-styles";
import { OG_IMAGE } from "@/lib/og-image";

type Params = { id: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return DESIGN_STYLES.map((style) => ({ id: style.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const style = getDesignStyle(id);
  if (!style) return {};
  const title = `${style.name} Layout | Sitesinc`;
  const description = `${style.blurb} One of eight Sitesinc layouts for the $1,995 website build.`;
  return {
    title,
    description,
    alternates: { canonical: `/styles/${style.id}` },
    openGraph: {
      title,
      description,
      url: `/styles/${style.id}`,
      images: [OG_IMAGE],
    },
  };
}

export default async function StyleDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  if (!isDesignStyleId(id)) notFound();
  const style = getDesignStyle(id);
  if (!style) notFound();

  const index = DESIGN_STYLES.findIndex((item) => item.id === style.id);
  const previous = DESIGN_STYLES[(index - 1 + DESIGN_STYLES.length) % DESIGN_STYLES.length];
  const next = DESIGN_STYLES[(index + 1) % DESIGN_STYLES.length];

  return (
    <SitePage>
      <OrgJsonLd />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Layout {index + 1} of {DESIGN_STYLES.length}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {style.name}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">{style.blurb}</p>
        <p className="mt-3 text-sm text-slate-400">
          Public preview of the live Sitesinc offer in this layout — not a client
          site.{" "}
          <Link href="/styles" className="font-medium text-brand-300 hover:underline">
            All 8 layouts
          </Link>
          {" · "}
          <Link href="/packages" className="font-medium text-brand-300 hover:underline">
            Packages
          </Link>
          {" · "}
          <Link href="/contact" className="font-medium text-brand-300 hover:underline">
            Contact
          </Link>
        </p>

        <div className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-surface-elevated/95 via-black to-surface/90 p-4 shadow-elevated">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-slate-300">
              Sitesinc · {style.name}
            </div>
          </div>
          <div className="rounded-[26px] border border-white/5 bg-black/40 p-4 sm:p-5">
            <MiniSiteFrame style={style} content={SITESINC_SITE} />
          </div>
        </div>

        <nav
          aria-label="Other layouts"
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link
            href={`/styles/${previous.id}`}
            className="text-sm font-medium text-slate-300 hover:text-brand-300"
          >
            ← {previous.name}
          </Link>
          <Link href="/#checklist" className="text-sm font-semibold text-brand-300 hover:underline">
            Request this layout · $1,995
          </Link>
          <Link
            href={`/styles/${next.id}`}
            className="text-sm font-medium text-slate-300 hover:text-brand-300 sm:text-right"
          >
            {next.name} →
          </Link>
        </nav>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DESIGN_STYLES.filter((item) => item.id !== style.id).map((item) => (
            <li key={item.id}>
              <Link
                href={`/styles/${item.id}`}
                className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-brand-400/40"
              >
                <span
                  className="mb-2 inline-block h-1.5 w-8 rounded-full"
                  style={{ backgroundColor: item.accent }}
                />
                <p className="text-sm font-semibold text-white">{item.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SitePage>
  );
}
