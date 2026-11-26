import Image from "next/image";
import Link from "next/link";
import { TRADES } from "@/data/trades";

/**
 * Illustrative photo for each trade card (redesign v2). These are
 * AI-generated scenes of the trade at work — atmosphere for the trade,
 * never presented as clients, jobs, or results.
 */
const TRADE_IMAGES: Record<string, { src: string; alt: string }> = {
  plumbers: {
    src: "/images/trades/plumbers.jpg",
    alt: "Plumber tightening a trap fitting under a kitchen sink, work light glowing",
  },
  roofers: {
    src: "/images/trades/roofers.jpg",
    alt: "Roofer nailing dark shingles on a house roof in late-afternoon light",
  },
  hvac: {
    src: "/images/trades/hvac.jpg",
    alt: "HVAC technician servicing an outdoor condenser unit with a gauge set",
  },
  electricians: {
    src: "/images/trades/electricians.jpg",
    alt: "Electrician wiring an open electrical panel",
  },
  landscapers: {
    src: "/images/trades/landscapers.jpg",
    alt: "Landscaper trimming a hedge in front of a Southern California home at golden hour",
  },
  "auto-repair": {
    src: "/images/trades/auto-repair.jpg",
    alt: "Mechanic working at the open hood of a car in a clean repair shop",
  },
};

/** Homepage: send each trade to a page that speaks to it (message match). */
export default function TradePicker() {
  return (
    <section id="trades" className="border-t border-white/5 bg-black py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Pick your trade</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Websites built for your trade.
        </h2>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Pick your trade to see what we build for it. Same $1,995 flat build, written around how your customers actually look for you.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((t) => {
            const image = TRADE_IMAGES[t.slug];
            return (
              <Link
                key={t.slug}
                href={`/trades/${t.slug}`}
                data-analytics-cta="trade_card"
                data-analytics-location={`home_${t.slug}`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-brand-400/60 hover:bg-brand-400/5"
              >
                {image ? (
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={960}
                    height={640}
                    className="h-44 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : null}
                <div className="p-5">
                  <p className="text-base font-semibold text-white">Websites for {t.name.toLowerCase()}</p>
                  <p className="mt-2 text-sm text-slate-300">{t.headline}</p>
                  <p className="mt-3 text-sm font-medium text-brand-300">
                    See the {t.short.toLowerCase()} page <span className="transition group-hover:translate-x-0.5">→</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Don&apos;t see your trade? <Link href="/trades" className="text-brand-300 hover:underline">All trades</Link> · We build for any local service business.
        </p>
      </div>
    </section>
  );
}
