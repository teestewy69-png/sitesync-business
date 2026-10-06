import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import s from "@/components/city-launch/city-landing.module.css";
import type { DesignStyle } from "@/lib/design-styles";
import { cityTheme, type ClientSiteLinks } from "@/lib/factory/city-launch-public";
import type { CityLaunchClientContext } from "@/lib/factory/city-launch";
import type { PublishedClientPage } from "@/lib/factory/client-domain";

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

/** Marker the global stylesheet uses to hide Sitesinc's own chrome (pricing ticker) on a client's real domain. */
export function ClientSiteMarker() {
  return <span data-client-site="" hidden />;
}

/**
 * Header + footer for pages on the client's real domain (home and approved workspace pages). City pages and the
 * locations index use CityLanding / LocationsIndex with the same links object.
 */
export default function ClientSiteShell({
  ctx,
  style,
  links,
  pages,
  hasLocations,
  children,
}: {
  ctx: CityLaunchClientContext;
  style: DesignStyle;
  links: ClientSiteLinks;
  pages: PublishedClientPage[];
  hasLocations: boolean;
  children: ReactNode;
}) {
  const theme = cityTheme(style);
  const tel = ctx.business.phone ? telHref(ctx.business.phone) : "";
  const vars = {
    "--cl-bg": theme.bg,
    "--cl-surface": theme.surface,
    "--cl-text": theme.text,
    "--cl-muted": theme.muted,
    "--cl-border": theme.border,
    "--cl-accent": style.accent,
    "--cl-scale": String(theme.headingScale),
  } as CSSProperties;
  const navPages = pages.filter((p) => p.slug !== "home").slice(0, 6);
  return (
    <div className={`${s.root} ${theme.variant === "split" ? s.split : s.center}`} style={vars}>
      <ClientSiteMarker />
      <div className={s.wrap}>
        <header className={s.header}>
          <Link href={links.home} className={s.brand}>
            <span className={s.logo}>{ctx.business.businessName.slice(0, 1).toUpperCase()}</span>
            {ctx.business.businessName}
          </Link>
          <nav className={s.nav} aria-label="Site">
            <Link href={links.home}>Home</Link>
            {navPages.map((p) => (
              <Link key={p.slug} href={p.path}>
                {p.title.split(/[|·]/)[0].trim()}
              </Link>
            ))}
            {hasLocations ? <Link href={links.locations}>Locations</Link> : null}
            {tel ? (
              <a className={`${s.btn} ${s.btnSmall}`} href={tel} data-lead="call">
                Call now
              </a>
            ) : null}
          </nav>
        </header>
      </div>
      {children}
      <footer className={s.footer}>
        <div className={s.wrap}>
          <p>
            {ctx.business.businessName}
            {ctx.business.baseCity ? ` · based in ${ctx.business.baseCity}${ctx.business.baseState ? `, ${ctx.business.baseState}` : ""}` : ""}
            {ctx.business.phone ? ` · ${ctx.business.phone}` : ""}
            {links.email ? ` · ${links.email}` : ""}
          </p>
          <p>
            {hasLocations ? (
              <>
                <Link href={links.locations}>Locations</Link> ·{" "}
              </>
            ) : null}
            {links.contact ? (
              <>
                <Link href={links.contact}>Contact</Link> ·{" "}
              </>
            ) : null}
            <a href={links.sitemap}>Sitemap</a>
          </p>
        </div>
      </footer>
      {tel ? (
        <a className={`${s.btn} ${s.stickyCall}`} href={tel} data-lead="call" aria-label={`Call ${ctx.business.businessName}`}>
          Call
        </a>
      ) : null}
    </div>
  );
}
