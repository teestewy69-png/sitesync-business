import type { Metadata } from "next";
import Link from "next/link";
import ClientSiteShell, { telHref } from "@/components/client-site/ClientSiteShell";
import Prose from "@/components/client-site/Prose";
import s from "@/components/city-launch/city-landing.module.css";
import { requireClientSite } from "@/lib/factory/client-domain";
import { clientPageMetadata, loadClientSiteView } from "@/lib/factory/client-site-view";

export const dynamic = "force-dynamic";

type Params = { host: string };

function homeCopy(view: Awaited<ReturnType<typeof loadClientSiteView>>) {
  const { ctx, pages } = view;
  const home = pages.find((p) => p.slug === "home");
  const niche = ctx.business.niche ? `${ctx.business.niche.charAt(0).toUpperCase()}${ctx.business.niche.slice(1)}` : "";
  const where = [ctx.business.baseCity, ctx.business.baseState].filter(Boolean).join(", ");
  const title = home?.title || [ctx.business.businessName, niche && where ? `${niche} in ${where}` : niche || where].filter(Boolean).join(" | ");
  const description =
    home?.metaDescription ||
    `${ctx.business.businessName}${niche ? `: ${niche.toLowerCase()}` : ""}${where ? ` based in ${where}` : ""}${view.cities.length ? `, serving ${view.cities.length} nearby cities` : ""}.`;
  return { home, niche, where, title, description };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { host } = await params;
  const site = await requireClientSite(host, "/");
  const view = await loadClientSiteView(site);
  const { title, description } = homeCopy(view);
  return clientPageMetadata(site, view.ctx.business.businessName, { title, description, path: "/" });
}

/** The client's real home page: only approved content and Census-backed city links, no sample copy. */
export default async function ClientDomainHome({ params }: { params: Promise<Params> }) {
  const { host } = await params;
  const site = await requireClientSite(host, "/");
  const view = await loadClientSiteView(site);
  const { ctx, cities, links, pages, style } = view;
  const { home, niche, where } = homeCopy(view);
  const tel = ctx.business.phone ? telHref(ctx.business.phone) : "";
  const contactHref = links.contact || (links.email ? `mailto:${links.email}` : "");
  return (
    <ClientSiteShell ctx={ctx} style={style} links={links} pages={pages} hasLocations={cities.length > 0}>
      <section className={s.hero}>
        <div className={`${s.orb} ${s.orbA}`} aria-hidden="true" />
        <div className={s.gridBg} aria-hidden="true" />
        <div className={s.wrap}>
          <div className={`${s.heroCopy} ${s.heroIn}`}>
            {niche || where ? (
              <span className={s.eyebrow}>
                <span className={s.dot} aria-hidden="true" /> {[niche, where].filter(Boolean).join(" · ")}
              </span>
            ) : null}
            <h1 className={s.h1}>{home?.title?.split(/[|·]/)[0].trim() || ctx.business.businessName}</h1>
            <p className={s.sub}>
              {niche ? `${niche} ` : ""}
              {where ? `from our ${where} base` : ""}
              {cities.length ? `, serving ${cities.length} nearby ${cities.length === 1 ? "city" : "cities"}.` : "."}
            </p>
            <div className={s.heroCtas}>
              {tel ? (
                <a className={s.btn} href={tel} data-lead="call">
                  Call {ctx.business.phone}
                </a>
              ) : null}
              {contactHref ? (
                <a className={tel ? s.btnGhost : s.btn} href={contactHref} data-lead="contact">
                  {links.contact ? "Contact us" : "Email us"}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <main className={s.wrap} style={{ paddingBottom: "4rem" }}>
        {home ? (
          <section className={s.section}>
            <Prose body={home.body} />
          </section>
        ) : null}
        {cities.length ? (
          <section className={s.section} aria-labelledby="areas">
            <p className={s.kicker}>Service areas</p>
            <h2 id="areas" className={s.h2}>
              Cities we serve{where ? ` from ${ctx.business.baseCity}` : ""}
            </h2>
            <div className={s.indexGrid}>
              {cities.slice(0, 60).map((c) => (
                <Link key={c.slug} href={links.city(c.slug)}>
                  {c.name}, {c.state}
                  <small>{c.population ? `${c.population.toLocaleString("en-US")} residents` : "Local page"}</small>
                </Link>
              ))}
            </div>
            {cities.length > 60 ? (
              <p className={s.lead}>
                <Link href={links.locations}>All {cities.length} service areas →</Link>
              </p>
            ) : null}
          </section>
        ) : null}
      </main>
    </ClientSiteShell>
  );
}
