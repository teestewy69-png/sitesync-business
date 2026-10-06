import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getUsCityIndex } from "@/lib/city-launch";
import type { CityLandingData } from "@/lib/factory/city-launch-public";
import { cityTheme, previewBase } from "@/lib/factory/city-launch-public";
import CityReveal from "./CityReveal";
import s from "./city-landing.module.css";

function Paragraphs({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={s.prose}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length && lines.every((l) => /^[-•*]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^[-•*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{lines.join(" ")}</p>;
      })}
    </div>
  );
}

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

/** Plots the city and its nearest real neighbours (Census internal-point coordinates) on a small animated SVG map. */
function ServiceMap({ data }: { data: CityLandingData }) {
  const { draft } = data;
  if (draft.city.lat === null || draft.city.lng === null || !draft.nearby.length) return null;
  const lat0 = draft.city.lat;
  const lng0 = draft.city.lng;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const index = getUsCityIndex();
  const pts = draft.nearby
    .slice(0, 6)
    .map((n) => {
      const c = index.bySlug.get(n.slug);
      return c ? { ...n, dx: (c.lng - lng0) * cos, dy: c.lat - lat0 } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  if (!pts.length) return null;
  const maxR = Math.max(...pts.map((p) => Math.hypot(p.dx, p.dy)), 1e-6);
  const placed = pts.map((p) => {
    // sqrt scale keeps close neighbours readable while preserving real direction and distance order.
    const r = 34 + 100 * Math.sqrt(Math.hypot(p.dx, p.dy) / maxR);
    const a = Math.atan2(-p.dy, p.dx);
    return { ...p, x: 200 + r * Math.cos(a), y: 150 + r * Math.sin(a) * 0.9 };
  });
  const live = new Set(data.nearbyLive.map((n) => n.slug));
  return (
    <div className={`${s.mapCard} ${s.reveal}`} data-reveal="">
      <svg viewBox="0 0 400 300" className={s.map} role="img" aria-label={`Map of ${draft.city.name} and nearby cities`}>
        {placed.map((p, i) => (
          <line key={p.slug} x1={200} y1={150} x2={p.x} y2={p.y} className={s.mapLine} style={{ "--d": `${0.25 + i * 0.12}s` } as CSSProperties} />
        ))}
        <circle cx={200} cy={150} r={14} className={s.ring} />
        <circle cx={200} cy={150} r={14} className={`${s.ring} ${s.ring2}`} />
        <circle cx={200} cy={150} r={14} className={`${s.ring} ${s.ring3}`} />
        <circle cx={200} cy={150} r={7} fill="var(--cl-accent)" />
        <text x={200} y={178} textAnchor="middle" className={s.mapLabelMain}>
          {draft.city.name}
        </text>
        {placed.map((p) => (
          <g key={`${p.slug}-pt`}>
            <circle cx={p.x} cy={p.y} r={live.has(p.slug) ? 5 : 3.5} fill={live.has(p.slug) ? "var(--cl-accent)" : "var(--cl-muted)"} />
            <text x={p.x} y={p.y - 9} textAnchor="middle" className={s.mapLabel}>
              {p.name} · {Math.round(p.distanceMiles)} mi
            </text>
          </g>
        ))}
      </svg>
      <p className={s.mapCaption}>
        Nearest cities to {draft.city.name}, plotted from U.S. Census coordinates. Highlighted dots have their own page.
      </p>
    </div>
  );
}

export default function CityLanding({ data, origin }: { data: CityLandingData; origin: string }) {
  const { ctx, draft, style, nearbyLive, isDraftPreview, project } = data;
  const theme = cityTheme(style);
  const c = draft.content;
  const base = previewBase(project.id);
  const contactHref = `${ctx.contactPath}?city=${encodeURIComponent(draft.slug)}`;
  const tel = ctx.business.phone ? telHref(ctx.business.phone) : "";
  const rootId = `cl-${draft.slug}`;
  const vars = {
    "--cl-bg": theme.bg,
    "--cl-surface": theme.surface,
    "--cl-text": theme.text,
    "--cl-muted": theme.muted,
    "--cl-border": theme.border,
    "--cl-accent": style.accent,
    "--cl-scale": String(theme.headingScale),
  } as CSSProperties;
  const fromBase =
    ctx.baseCity && draft.city.lat !== null && draft.city.lng !== null && ctx.baseCity.slug !== draft.slug
      ? Math.round(
          Math.hypot(
            (draft.city.lat - ctx.baseCity.lat) * 69,
            (draft.city.lng - ctx.baseCity.lng) * 69 * Math.cos((ctx.baseCity.lat * Math.PI) / 180)
          )
        )
      : null;
  const cta = (extra?: string): ReactNode => (
    <>
      {tel ? (
        <a className={`${s.btn} ${extra || ""}`} href={tel} data-lead="call" data-city={draft.slug}>
          Call {ctx.business.phone}
        </a>
      ) : null}
      <Link className={tel ? `${s.btnGhost} ${extra || ""}` : `${s.btn} ${extra || ""}`} href={contactHref} data-lead="contact" data-city={draft.slug}>
        {tel ? "Request service online" : `Contact ${ctx.business.businessName}`}
      </Link>
    </>
  );
  const h1 = c.h1 || c.title;
  const cityIdx = h1.toLowerCase().indexOf(draft.city.name.toLowerCase());

  return (
    <div id={rootId} className={`${s.root} ${theme.variant === "split" ? s.split : s.center}`} style={vars}>
      <CityReveal rootId={rootId} />
      <p className={s.banner}>
        {isDraftPreview
          ? `Operator draft preview · ${draft.status} · not visible to the public · noindex`
          : `Client preview on Sitesinc · ${ctx.business.businessName} · noindex until published to the client's domain`}
      </p>
      <div className={s.wrap}>
        <header className={s.header}>
          <Link href={base} className={s.brand}>
            <span className={s.logo}>{ctx.business.businessName.slice(0, 1).toUpperCase()}</span>
            {ctx.business.businessName}
          </Link>
          <nav className={s.nav} aria-label="Site">
            <Link href={base}>Home</Link>
            <Link href={`${base}/locations`}>Locations</Link>
            <Link href={ctx.contactPath}>Contact</Link>
            {tel ? (
              <a className={`${s.btn} ${s.btnSmall}`} href={tel} data-lead="call" data-city={draft.slug}>
                Call now
              </a>
            ) : null}
          </nav>
        </header>
      </div>

      <section className={s.hero}>
        <div className={`${s.orb} ${s.orbA}`} aria-hidden="true" />
        <div className={`${s.orb} ${s.orbB}`} aria-hidden="true" />
        <div className={s.gridBg} aria-hidden="true" />
        <div className={s.wrap}>
          <div className={s.heroGrid}>
            <div className={`${s.heroCopy} ${s.heroIn}`}>
              <span className={s.eyebrow}>
                <span className={s.dot} aria-hidden="true" /> {draft.keyword} · {draft.city.name}, {draft.city.state}
              </span>
              <h1 className={s.h1}>
                {cityIdx >= 0 ? (
                  <>
                    {h1.slice(0, cityIdx)}
                    <span className={s.accentText}>{h1.slice(cityIdx, cityIdx + draft.city.name.length)}</span>
                    {h1.slice(cityIdx + draft.city.name.length)}
                  </>
                ) : (
                  h1
                )}
              </h1>
              {c.heroSubhead ? <p className={s.sub}>{c.heroSubhead}</p> : null}
              <div className={s.heroCtas}>{cta()}</div>
              <div className={s.chips}>
                {draft.city.population > 0 ? (
                  <span className={s.chip}>
                    <strong>{draft.city.population.toLocaleString("en-US")}</strong>residents (2024 est.)
                  </span>
                ) : null}
                {draft.city.county ? (
                  <span className={s.chip}>
                    <strong>{draft.city.county}</strong>
                    {draft.city.stateName}
                  </span>
                ) : null}
                {fromBase !== null && ctx.baseCity ? (
                  <span className={s.chip}>
                    <strong>~{fromBase} mi</strong>from our {ctx.baseCity.name} base
                  </span>
                ) : null}
              </div>
            </div>
            {theme.variant === "split" ? <ServiceMap data={data} /> : null}
          </div>
          {theme.variant === "center" ? <ServiceMap data={data} /> : null}
        </div>
      </section>

      <main>
        {c.intro ? (
          <section className={s.section}>
            <div className={s.wrap}>
              <p className={`${s.lead} ${s.reveal}`} data-reveal="">
                {c.intro}
              </p>
            </div>
          </section>
        ) : null}

        {c.localHighlights.length ? (
          <section className={s.section} aria-labelledby="cl-local">
            <div className={s.wrap}>
              <p className={s.kicker}>Local to {draft.city.name}</p>
              <h2 id="cl-local" className={`${s.h2} ${s.reveal}`} data-reveal="">
                What matters for {draft.keyword} in {draft.city.name}
              </h2>
              <div className={s.highlights}>
                {c.localHighlights.map((h, i) => (
                  <div key={i} className={`${s.card} ${s.reveal}`} data-reveal="" style={{ "--d": `${i * 0.07}s` } as CSSProperties}>
                    <div className={s.cardNum}>{String(i + 1).padStart(2, "0")}</div>
                    <p style={{ margin: "0.5rem 0 0", lineHeight: 1.6 }}>{h}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.story}>
              {c.sections.map((section, i) => (
                <article key={i} className={`${s.storyBlock} ${s.reveal}`} data-reveal="">
                  <div className={s.storyIndex} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h2 className={s.h2}>{section.heading}</h2>
                    <Paragraphs text={section.body} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {c.faq.length ? (
          <section className={s.section} aria-labelledby="cl-faq">
            <div className={`${s.wrap} ${s.faq}`}>
              <p className={s.kicker}>FAQ</p>
              <h2 id="cl-faq" className={`${s.h2} ${s.reveal}`} data-reveal="">
                {draft.city.name} questions, answered
              </h2>
              {c.faq.map((f, i) => (
                <details key={i} className={s.reveal} data-reveal="">
                  <summary>{f.question}</summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <section className={s.section} aria-labelledby="cl-nearby">
          <div className={s.wrap}>
            <p className={s.kicker}>Service area</p>
            <h2 id="cl-nearby" className={`${s.h2} ${s.reveal}`} data-reveal="">
              Also serving near {draft.city.name}
            </h2>
            <div className={`${s.nearby} ${s.reveal}`} data-reveal="">
              {nearbyLive.map((n) => (
                <Link key={n.slug} href={`${base}/locations/${n.slug}`}>
                  {n.name}, {n.state}
                  {n.distanceMiles ? <small>{Math.round(n.distanceMiles)} mi</small> : null}
                </Link>
              ))}
              <Link href={`${base}/locations`}>All locations →</Link>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <div className={`${s.ctaBand} ${s.reveal}`} data-reveal="">
              <h2 className={s.h2}>{c.ctaHeadline || `Need ${draft.keyword} in ${draft.city.name}?`}</h2>
              {c.ctaText ? <p>{c.ctaText}</p> : null}
              <div className={s.heroCtas}>{cta()}</div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.wrap}>
          <p>
            {ctx.business.businessName}
            {ctx.business.baseCity ? ` · based in ${ctx.business.baseCity}${ctx.business.baseState ? `, ${ctx.business.baseState}` : ""}` : ""}
            {ctx.business.phone ? ` · ${ctx.business.phone}` : ""}
          </p>
          <p>
            <Link href={`${base}/locations`}>Locations</Link> · <Link href={ctx.contactPath}>Contact</Link> ·{" "}
            <a href={`${origin}${base}/sitemap.xml`}>Sitemap</a>
          </p>
          <p>City facts: U.S. Census Bureau (Vintage 2024 population estimates, 2024 Gazetteer).</p>
        </div>
      </footer>
      {tel ? (
        <a className={`${s.btn} ${s.stickyCall}`} href={tel} data-lead="call" data-city={draft.slug} aria-label={`Call ${ctx.business.businessName}`}>
          Call
        </a>
      ) : null}
    </div>
  );
}
