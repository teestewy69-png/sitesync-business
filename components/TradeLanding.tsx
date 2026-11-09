import Link from "next/link";
import { Check, X } from "lucide-react";
import SitePage from "@/components/SitePage";
import PilotOffer from "@/components/PilotOffer";
import {
  COMMON_TRADE_FAQS,
  SERVICE_AREA,
  SERVICE_AREA_LIST,
  SITESINC_EMAIL,
  SITESINC_PHONE,
  SITESINC_PHONE_HREF,
  STRIPE_LINKS,
  TRADES,
  type Trade,
} from "@/data/trades";

function TradeJsonLd({ trade }: { trade: Trade }) {
  const origin = "https://sitesinc.co";
  const url = `${origin}/trades/${trade.slug}`;
  const faqs = [...trade.faqs, ...COMMON_TRADE_FAQS];
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `Website design for ${trade.name.toLowerCase()}`,
        serviceType: "Website design and development",
        provider: { "@id": `${origin}/#organization`, "@type": "Organization", name: "Sitesinc", telephone: "+1-909-323-1575", email: SITESINC_EMAIL, url: origin },
        areaServed: SERVICE_AREA_LIST.map((name) => ({ "@type": "AdministrativeArea", name: `${name}, CA` })),
        offers: { "@type": "Offer", price: "1995", priceCurrency: "USD", description: "$1,995 flat. 50% ($997.50) to start, 50% at launch." },
        url,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function TradeLanding({ trade }: { trade: Trade }) {
  const faqs = [...trade.faqs, ...COMMON_TRADE_FAQS];
  const others = TRADES.filter((t) => t.slug !== trade.slug);
  const loc = `trade_${trade.slug}`;

  return (
    <SitePage>
      <TradeJsonLd trade={trade} />

      {/* Hero: the headline repeats the promise from the ad/post that sent them here (message match). */}
      <section className="relative overflow-hidden bg-gradient-to-b from-black via-canvas to-black">
        <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 py-14 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {trade.overline} · Southern California
          </p>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{trade.headline}</h1>
          <p className="mt-5 text-balance text-base text-slate-300 sm:text-lg">{trade.subheadline}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={SITESINC_PHONE_HREF}
              data-analytics-cta="call"
              data-analytics-location={`${loc}_hero`}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-brand-500/30"
            >
              Call {SITESINC_PHONE}
            </a>
            <a
              href="#what-we-build"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100 hover:border-brand-400/60"
            >
              See what&apos;s in a {trade.short.toLowerCase()} site
            </a>
          </div>
          <p className="mt-5 text-sm text-slate-400">
            $1,995 flat · $997.50 to start, $997.50 at launch · Serving {SERVICE_AREA}
          </p>
        </div>
      </section>

      <section className="border-t border-white/5 bg-black px-6 py-14">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">How your customers find you</h2>
            <p className="mt-3 text-base text-slate-300">{trade.searchMoment}</p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Common website problems we fix</h2>
            <ul className="mt-4 space-y-3">
              {trade.problems.map((p) => (
                <li key={p} className="flex items-start gap-3 text-base text-slate-300">
                  <X className="mt-1 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="what-we-build" className="scroll-mt-6 border-t border-white/5 bg-surface-muted/60 px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What we build into a {trade.short.toLowerCase()} website</h2>
          <p className="mt-3 text-base text-slate-300">
            Custom, mobile-first, search-friendly, and yours to keep. We only put services, hours and claims on your site that you tell us are true.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trade.build.map((b) => (
              <div key={b.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="flex items-center gap-2 text-base font-semibold text-white">
                  <Check className="h-4 w-4 shrink-0 text-brand-400" />
                  {b.title}
                </p>
                <p className="mt-2 text-sm text-slate-300">{b.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Also in every build: on-page SEO setup, domain connection, hosting setup, full code handoff and 1 round of revisions. <Link href="/services" className="text-brand-300 hover:underline">Full list</Link>
          </p>
        </div>
      </section>

      <section id="pricing" className="border-t border-white/5 bg-black px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One flat price. No contract.</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <div className="rounded-3xl bg-surface p-7 ring-2 ring-brand-500/60 lg:col-span-3">
              <p className="text-lg font-semibold">Website build</p>
              <p className="mt-4 text-5xl font-bold tracking-tight">$1,995</p>
              <p className="mt-2 text-base text-slate-300">$997.50 to start · $997.50 at launch</p>
              <p className="mt-2 text-sm text-emerald-300">Pilot pricing: $1,495 for our first 3 clients. Ask if a spot is open.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href={SITESINC_PHONE_HREF} data-analytics-cta="call" data-analytics-location={`${loc}_pricing`} className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-3 text-sm font-semibold text-zinc-950">
                  Talk it over first: {SITESINC_PHONE}
                </a>
                <a href={STRIPE_LINKS.deposit} target="_blank" rel="noopener noreferrer" data-analytics-cta="stripe_deposit" data-analytics-location={`${loc}_pricing`} className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/10">
                  Ready? Pay the $997.50 start deposit
                </a>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Prefer one payment? <a href={STRIPE_LINKS.full} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">Pay the full $1,995</a>. Secure checkout by Stripe.
              </p>
            </div>
            <div className="rounded-3xl bg-surface p-7 ring-1 ring-white/10 lg:col-span-2">
              <p className="text-lg font-semibold">Monitoring (optional)</p>
              <p className="mt-4 text-2xl font-bold tracking-tight">1st month free, then $129/mo</p>
              <p className="mt-2 text-xs text-slate-400">Card required at signup • $129/mo starting day 31 unless canceled before 30 days.</p>
              <p className="mt-3 text-sm text-slate-300">Uptime and SEO monitoring, technical updates and security, basic fixes, and 2-3 small text or image updates a month. Cancel anytime. Your site works without it.</p>
              <a href={STRIPE_LINKS.monitoring} target="_blank" rel="noopener noreferrer" data-analytics-cta="stripe_monitoring" data-analytics-location={`${loc}_pricing`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/10">
                Add monitoring
              </a>
            </div>
          </div>
        </div>
      </section>

      <PilotOffer location={trade.slug} />

      <section id="faq" className="border-t border-white/5 bg-black px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions {trade.name.toLowerCase()} ask us</h2>
          <div className="mt-6 divide-y divide-white/10">
            {faqs.map((f) => (
              <details key={f.question} className="group py-4">
                <summary className="cursor-pointer list-none text-base font-medium text-white">{f.question}</summary>
                <p className="mt-2 text-base text-slate-300">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-surface-muted/60 px-6 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Not sure yet? Just ask.</h2>
          <p className="mt-3 text-base text-slate-300">
            No pressure. Call or email and we&apos;ll tell you honestly whether a new site makes sense for your business.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={SITESINC_PHONE_HREF} data-analytics-cta="call" data-analytics-location={`${loc}_footer_cta`} className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-6 py-3 text-sm font-semibold text-zinc-950">
              Call {SITESINC_PHONE}
            </a>
            <a href={`mailto:${SITESINC_EMAIL}?subject=${encodeURIComponent(`Website for my ${trade.short.toLowerCase()} business`)}`} className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100">
              Email {SITESINC_EMAIL}
            </a>
            <Link href="/contact" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-slate-100">
              Send a request
            </Link>
          </div>
          <p className="mt-8 text-sm text-slate-400">
            Other trades:{" "}
            {others.map((t, i) => (
              <span key={t.slug}>
                <Link href={`/trades/${t.slug}`} className="text-brand-300 hover:underline">{t.name}</Link>
                {i < others.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* Sticky tap-to-call bar on phones */}
      <a
        href={SITESINC_PHONE_HREF}
        data-analytics-cta="call"
        data-analytics-location={`${loc}_sticky`}
        className="fixed inset-x-3 bottom-3 z-[150] flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 py-3 text-sm font-semibold text-zinc-950 shadow-lg md:hidden"
      >
        Call {SITESINC_PHONE}
      </a>
      <div className="h-16 md:hidden" aria-hidden="true" />
    </SitePage>
  );
}
