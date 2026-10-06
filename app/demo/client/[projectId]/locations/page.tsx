import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CityReveal from "@/components/city-launch/CityReveal";
import s from "@/components/city-launch/city-landing.module.css";
import { approvedEntries, cityTheme, previewBase } from "@/lib/factory/city-launch-public";
import { cityLaunchContext, readCityIndex } from "@/lib/factory/city-launch";
import { DESIGN_STYLES } from "@/lib/design-styles";
import { findProjectById } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  const name = project?.businessName || project?.label || "Locations";
  return {
    title: { absolute: `Service areas · ${name}` },
    description: `Cities ${name} serves, each with its own local page.`,
    robots: { index: false, follow: false },
  };
}

export default async function LocationsIndex({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  if (!project) notFound();
  const ctx = cityLaunchContext(project);
  const style = DESIGN_STYLES.find((d) => d.id === ctx.designStyleId) || DESIGN_STYLES[0];
  const theme = cityTheme(style);
  const pages = approvedEntries(await readCityIndex(projectId));
  const base = previewBase(projectId);
  const byState = new Map<string, typeof pages>();
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
      <p className={s.banner}>Client preview on Sitesinc · {ctx.business.businessName} · approved city pages only · noindex</p>
      <div className={s.wrap}>
        <header className={s.header}>
          <Link href={base} className={s.brand}>
            <span className={s.logo}>{ctx.business.businessName.slice(0, 1).toUpperCase()}</span>
            {ctx.business.businessName}
          </Link>
          <nav className={s.nav}>
            <Link href={base}>Home</Link>
            <Link href={ctx.contactPath}>Contact</Link>
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
              {ctx.business.niche ? `${ctx.business.niche} ` : ""}
              {ctx.business.baseCity ? `from our ${ctx.business.baseCity} base. ` : ""}Pick your city for local details.
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
              <h2 className={s.h2}>{state}</h2>
              <div className={s.indexGrid}>
                {list.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={`${base}/locations/${p.slug}`}
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
