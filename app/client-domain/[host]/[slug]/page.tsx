import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClientSiteShell from "@/components/client-site/ClientSiteShell";
import Prose from "@/components/client-site/Prose";
import s from "@/components/city-launch/city-landing.module.css";
import { requireClientSite } from "@/lib/factory/client-domain";
import { clientPageMetadata, loadClientSiteView } from "@/lib/factory/client-site-view";

export const dynamic = "force-dynamic";

type Params = { host: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { host, slug } = await params;
  const site = await requireClientSite(host, `/${slug}`);
  const view = await loadClientSiteView(site);
  const page = view.pages.find((p) => p.slug === slug && slug !== "home");
  if (!page) return { title: "Not found", robots: { index: false, follow: false } };
  return clientPageMetadata(site, view.ctx.business.businessName, {
    title: page.title,
    description: page.metaDescription || `${page.title} · ${view.ctx.business.businessName}`,
    path: page.path,
  });
}

/** An approved workspace page (contact, services...) on the client's real domain. Unapproved slugs 404. */
export default async function ClientDomainPage({ params }: { params: Promise<Params> }) {
  const { host, slug } = await params;
  const site = await requireClientSite(host, `/${slug}`);
  const view = await loadClientSiteView(site);
  const page = view.pages.find((p) => p.slug === slug && slug !== "home");
  if (!page) notFound();
  return (
    <ClientSiteShell ctx={view.ctx} style={view.style} links={view.links} pages={view.pages} hasLocations={view.cities.length > 0}>
      <main className={s.wrap} style={{ paddingBottom: "4rem" }}>
        <section className={s.section}>
          <h1 className={s.h1}>{page.title.split(/[|·]/)[0].trim()}</h1>
          <Prose body={page.body} />
        </section>
      </main>
    </ClientSiteShell>
  );
}
