import Image from "next/image";
import content from "@/content.json";
import SiteHeader from "@/components/SiteHeader";

export default function Hero() {
  const { hero, pricing } = content;
  const startHref = pricing.build.cta.href;

  return (
    <section className="relative bg-black text-white">
      <SiteHeader variant="hero" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-brand-300">
            {hero.overline}
          </p>

          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            {hero.headline}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            {hero.subheadline}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href={startHref}
              data-analytics-cta="start_build"
              data-analytics-location="hero"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-7 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-brand-500/20 transition hover:from-brand-200 hover:to-brand-500"
            >
              {hero.primaryCta.label}
            </a>
            <a
              href="tel:+19093231575"
              data-analytics-cta="call"
              data-analytics-location="hero"
              className="text-sm font-medium text-slate-200 underline decoration-brand-400/60 underline-offset-4 transition hover:text-brand-300"
            >
              Call (909) 323-1575
            </a>
          </div>

          <p className="mt-10 text-sm text-slate-400">{hero.pricingLine}</p>
          <p className="mt-2 text-sm text-slate-500">
            Timeline confirmed in writing before work starts.
          </p>
        </div>

        <figure className="relative">
          <div
            aria-hidden
            className="absolute -inset-6 rounded-[36px] bg-brand-500/10 blur-2xl"
          />
          <Image
            src="/images/hero-owner.jpg"
            alt="A salon owner in her own shop, smiling as she answers a call from a customer"
            width={1920}
            height={1280}
            priority
            className="relative aspect-[3/2] w-full rounded-[30px] object-cover shadow-elevated ring-1 ring-white/15"
            sizes="(max-width: 1024px) 100vw, 560px"
          />
        </figure>
      </div>
    </section>
  );
}
