import Link from "next/link";
import { TRADES } from "@/data/trades";

/** Homepage: send each trade to a page that speaks to it (message match). */
export default function TradePicker() {
  return (
    <section id="trades" className="border-t border-white/5 bg-black py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Pick your trade</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Your website should make the phone ring. If it just sits there, it&apos;s a business card.
        </h2>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Pick your trade to see what we build for it. Same $1,995 flat build, written around how your customers actually look for you.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((t) => (
            <Link
              key={t.slug}
              href={`/trades/${t.slug}`}
              data-analytics-cta="trade_card"
              data-analytics-location={`home_${t.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/60 hover:bg-brand-400/5"
            >
              <p className="text-base font-semibold text-white">Websites for {t.name.toLowerCase()}</p>
              <p className="mt-2 text-sm text-slate-300">{t.headline}</p>
              <p className="mt-3 text-sm font-medium text-brand-300">
                See the {t.short.toLowerCase()} page <span className="transition group-hover:translate-x-0.5">→</span>
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Don&apos;t see your trade? <Link href="/trades" className="text-brand-300 hover:underline">All trades</Link> · We build for any local service business.
        </p>
      </div>
    </section>
  );
}
