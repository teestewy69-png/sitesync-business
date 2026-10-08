import type { CSSProperties } from "react";
import Link from "next/link";
import { getUsCityIndex } from "@/lib/city-launch";
import type { CityIndexEntry } from "@/lib/city-launch/job";
import type { DesignStyle } from "@/lib/design-styles";
import { cityTheme, type ClientSiteLinks } from "@/lib/factory/city-launch-public";
import type { CityLaunchClientContext } from "@/lib/factory/city-launch";
import CityReveal from "./CityReveal";
import s from "./city-landing.module.css";

/** Service-area index (approved city pages only), shared by the Sitesinc preview and the client's real domain. */
export default function LocationsIndex({
  ctx,
  style,
  pages,
  links,
}: {
  ctx: CityLaunchClientContext;
  style: DesignStyle;
  pages: CityIndexEntry[];
  links: ClientSiteLinks;
}) {
  const theme = cityTheme(style);
  const byState = new Map<string, CityIndexEntry[]>();
  for (const p of pages) {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state)!.push(p);
  }
  const vars = {
    "--cl-bg": theme.bg,
    "--cl-surface": theme.surface,
    "--cl-text": theme.text,
    "--cl-muted": theme.muted,
    "--cl-border": theme.border,
    "--cl-accent": style.accent,
    "--cl-scale": String(theme.headingScale),
  } as CSSProperties;
  return (
    <div id="cl-locations" className={`${s.root} ${s.center}`} style={vars}>
      <CityReveal rootId="cl-locations" />
      {links.mode === "preview" ? (
        <p className={s.banner}>Client preview on Sitesinc · {ctx.business.businessName} · approved city pages only · noindex</p>
      ) : null}
      <div className={s.wrap}>
        <header className={s.header}>
          <Link href={links.home} className={s.brand}>
            <span className={s.logo}>{ctx.business.businessName.slice(0, 1).toUpperCase()}</span>
            {ctx.business.businessName}
          </Link>
          <nav className={s.nav}>
            <Link href={links.home}>Home</Link>
            {links.contact ? <Link href={links.contact}>Contact</Link> : null}
          </nav>
        </header>
      </div>
      <section className={s.hero}>
        <div className={`${s.orb} ${s.orbA}`} aria-hidden="true" />
        <div className={s.gridBg} aria-hidden="true" />
        <div className={s.wrap}>
          <div className={`${s.heroCopy} ${s.heroIn}`}>
            <span className={s.eyebrow}>
              <span className={s.dot} aria-hidden="true" /> {pages.length} service area{pages.length === 1 ? "" : "s"}
            </span>
            <h1 className={s.h1}>
              Where <span className={s.accentText}>{ctx.business.businessName}</span> works
            </h1>
            <p className={s.sub}>
              {[
                ctx.business.niche ? `${ctx.business.niche.charAt(0).toUpperCase()}${ctx.business.niche.slice(1)}` : "Serving these cities",
                ctx.business.baseCity ? `from our ${ctx.business.baseCity} base.` : ".",
              ].join(" ").replace(" .", ".")}{" "}
              Pick your city for local details.
            </p>
          </div>
        </div>
      </section>
      <main className={s.wrap} style={{ paddingBottom: "4rem" }}>
        {pages.length === 0 ? (
          <p className={s.lead}>No city pages are approved yet.</p>
        ) : (
          [...byState.entries()].map(([state, list]) => (
            <section key={state} className={s.section}>
              <h2 className={s.h2}>{getUsCityIndex().states.get(state) || state}</h2>
              <div className={s.indexGrid}>
                {list.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={links.city(p.slug)}
                    className={s.reveal}
                    data-reveal=""
                    style={{ "--d": `${Math.min(i, 12) * 0.03}s` } as CSSProperties}
                  >
                    {p.name}, {p.state}
                    <small>{p.population ? `${p.population.toLocaleString("en-US")} residents` : "Local page"}</small>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
