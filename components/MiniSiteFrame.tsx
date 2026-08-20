import type {
  DesignStyle,
  DesignStyleId,
  MiniSiteContent,
} from "@/lib/design-styles";

type Props = {
  style: DesignStyle;
  content: MiniSiteContent;
};

export default function MiniSiteFrame({ style, content }: Props) {
  return (
    <div className="space-y-4">
      <SiteChrome business={content.business} accent={style.accent} />
      <LayoutBody id={style.id} accent={style.accent} content={content} />
      <FooterBand content={content} accent={style.accent} />
    </div>
  );
}

function SiteChrome({
  business,
  accent,
}: {
  business: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black"
          style={{
            background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.85))`,
          }}
        >
          {business.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-slate-100">{business}</span>
      </div>
      <div className="hidden items-center gap-4 text-xs text-slate-400 sm:flex">
        <span>Services</span>
        <span>Reviews</span>
        <span>Contact</span>
      </div>
    </div>
  );
}

function LayoutBody({
  id,
  accent,
  content,
}: {
  id: DesignStyleId;
  accent: string;
  content: MiniSiteContent;
}) {
  switch (id) {
    case "neon-glass":
      return <NeonGlass accent={accent} content={content} />;
    case "purple-gradient":
      return <PurpleGradient accent={accent} content={content} />;
    case "minimal-dark":
      return <MinimalDark accent={accent} content={content} />;
    case "split-hero":
      return <SplitHero accent={accent} content={content} />;
    case "card-grid":
      return <CardGrid accent={accent} content={content} />;
    case "bold-type":
      return <BoldType accent={accent} content={content} />;
    case "photo-focus":
      return <PhotoFocus accent={accent} content={content} />;
    case "funnel-ready":
      return <FunnelReady accent={accent} content={content} />;
  }
}

function NeonGlass({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Local experts
        </p>
        <h3
          className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{
            color: accent,
            textShadow: `0 0 22px ${accent}88`,
          }}
        >
          {content.business}
        </h3>
        <p className="mt-3 max-w-2xl text-base text-slate-300">{content.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <CtaButton label={content.cta} accent={accent} darkText />
          <GhostButton label={content.phone} />
        </div>
      </div>
      <ServicesRow services={content.services.slice(0, 3)} accent={accent} />
      <TestimonialsRow testimonials={content.testimonials.slice(0, 2)} />
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function PurpleGradient({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6">
          <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.business}
          </h3>
          <p className="mt-3 text-base text-slate-300">{content.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <div
              className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{
                background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,0.28))`,
              }}
            >
              {content.cta}
            </div>
            <GhostButton label={content.phone} />
          </div>
        </div>
        <RoofPanel
          accent={accent}
          label="Live pages"
          caption="Dark, glossy layouts built to convert."
          gradient={`linear-gradient(135deg, ${accent}99, rgba(255,255,255,0.04), rgba(0,0,0,0.35))`}
        />
      </div>
      <ServicesRow services={content.services.slice(0, 4)} accent={accent} cols={4} />
      <TestimonialsRow testimonials={content.testimonials.slice(0, 2)} />
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function MinimalDark({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-black/25 p-6">
        <div className="max-w-2xl">
          <h3 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            {content.business}
          </h3>
          <p className="mt-3 text-base text-slate-300">{content.tagline}</p>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {content.services.map((service) => (
            <div
              key={service.name}
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div
                className="h-1 w-8 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <p className="mt-3 text-sm font-medium text-slate-100">
                {service.name}
              </p>
              <p className="mt-1 text-xs font-semibold" style={{ color: accent }}>
                {service.price}
              </p>
              <p className="mt-2 text-base leading-relaxed text-slate-400">
                {service.blurb}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <CtaButton label={content.cta} accent={accent} darkText />
          <GhostButton label={`Call ${content.phone}`} />
        </div>
      </div>
      <TestimonialsRow testimonials={content.testimonials} />
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function SplitHero({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <RoofPanel
          accent={accent}
          label="Hero visual"
          caption="Clean lines. Fast pages. Built to convert."
          gradient="linear-gradient(160deg, #2a2318 0%, #5c4a2e 40%, #1a1612 100%)"
        />
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.business}
          </h3>
          <p className="mt-3 text-base text-slate-300">{content.tagline}</p>
          <div className="mt-5 space-y-3">
            {content.services.slice(0, 2).map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {service.name}
                  </p>
                  <p className="text-base text-slate-400">{service.blurb}</p>
                </div>
                <span
                  className="shrink-0 text-sm font-semibold"
                  style={{ color: accent }}
                >
                  {service.price}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <CtaButton label={content.cta} accent={accent} darkText />
          </div>
        </div>
      </div>
      <TestimonialsRow testimonials={content.testimonials.slice(0, 2)} />
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function CardGrid({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {content.business}
            </h3>
            <p className="mt-3 max-w-xl text-base text-slate-300">
              {content.tagline}
            </p>
          </div>
          <CtaButton label={content.cta} accent={accent} darkText />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {content.services.map((service) => (
            <div
              key={service.name}
              className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4"
            >
              <div
                className="mb-3 h-16 rounded-xl"
                style={{
                  background: `linear-gradient(145deg, ${accent}55, rgba(0,0,0,0.45))`,
                }}
              />
              <p className="text-sm font-medium text-slate-100">{service.name}</p>
              <p className="mt-1 text-xs font-semibold" style={{ color: accent }}>
                {service.price}
              </p>
            </div>
          ))}
        </div>
      </div>
      <TestimonialsRow testimonials={content.testimonials.slice(0, 2)} />
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function BoldType({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.02] p-6">
        <h3 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {content.business}
        </h3>
        <p className="mt-4 max-w-2xl text-base text-slate-300">{content.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <CtaButton label={content.cta} accent={accent} />
          <GhostButton label={content.phone} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {content.services.slice(0, 2).map((service) => (
            <div
              key={service.name}
              className="rounded-2xl border border-white/5 bg-surface/80 p-5"
            >
              <p className="text-lg font-semibold text-slate-50">{service.name}</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>
                {service.price}
              </p>
              <p className="mt-2 text-base leading-relaxed text-slate-400">
                {service.blurb}
              </p>
            </div>
          ))}
        </div>
      </div>
      <TestimonialsRow testimonials={content.testimonials.slice(0, 2)} />
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function PhotoFocus({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <RoofPanel
        accent={accent}
        label="Live at sitesinc.co"
        caption="Dark, glossy, money-ready pages — this is the real site."
        tall
        gradient="linear-gradient(180deg, #3d3428 0%, #1a1612 55%, #0c0b09 100%)"
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {content.business}
          </h3>
          <p className="mt-3 text-base text-slate-300">{content.tagline}</p>
          <div className="mt-5 space-y-2">
            {content.services.slice(0, 3).map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-200">{service.name}</span>
                <span className="font-semibold" style={{ color: accent }}>
                  {service.price}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Customer feedback
          </p>
          <p className="mt-3 text-base leading-relaxed text-slate-200">
            “{content.testimonials[0]?.quote}”
          </p>
          <p className="mt-3 text-sm font-medium text-slate-400">
            — {content.testimonials[0]?.name}
          </p>
          <div className="mt-5">
            <CtaButton label={content.cta} accent={accent} darkText />
          </div>
        </div>
      </div>
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function FunnelReady({
  accent,
  content,
}: {
  accent: string;
  content: MiniSiteContent;
}) {
  return (
    <>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-6">
        <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {content.business}
        </h3>
        <p className="mt-3 text-base text-slate-300">{content.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <CtaButton label={content.cta} accent={accent} />
          <GhostButton label={`Call ${content.phone}`} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["Tell us the job", "Get a clear price", "Book the crew"].map(
          (step, index) => (
            <div
              key={step}
              className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-black"
                style={{ backgroundColor: accent }}
              >
                {index + 1}
              </div>
              <p className="mt-3 text-sm font-medium text-slate-100">{step}</p>
              <p className="mt-1 text-sm text-slate-400">
                {content.services[index]?.name ?? "Next step"} ·{" "}
                {content.services[index]?.price ?? ""}
              </p>
            </div>
          ),
        )}
      </div>
      <div className="rounded-[26px] border border-white/5 bg-white/[0.03] p-5">
        <p className="text-xs uppercase tracking-wider text-slate-400">
          What neighbors say
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {content.testimonials.slice(0, 2).map((item) => (
            <div key={item.name} className="rounded-xl bg-black/25 p-4">
              <p className="text-base leading-relaxed text-slate-300">
                “{item.quote}”
              </p>
              <p className="mt-2 text-sm font-medium text-slate-400">
                — {item.name}
              </p>
            </div>
          ))}
        </div>
      </div>
      <TrustStrip signals={content.trustSignals} accent={accent} />
    </>
  );
}

function RoofPanel({
  accent,
  label,
  caption = "Clean lines. Fast pages. Built to convert.",
  gradient,
  tall,
}: {
  accent: string;
  label: string;
  caption?: string;
  gradient: string;
  tall?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] p-4 ${tall ? "min-h-[200px]" : "min-h-[180px]"}`}
      style={{ background: gradient }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `linear-gradient(90deg, transparent 0%, ${accent}22 50%, transparent 100%), repeating-linear-gradient(115deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 18px)`,
        }}
      />
      <div className="relative flex h-full min-h-[150px] flex-col justify-end rounded-[18px] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-wider text-slate-300">
          {label}
        </p>
        <p className="mt-1 text-base font-medium text-slate-100">{caption}</p>
      </div>
    </div>
  );
}

function ServicesRow({
  services,
  accent,
  cols = 3,
}: {
  services: MiniSiteContent["services"];
  accent: string;
  cols?: 3 | 4;
}) {
  return (
    <div
      className={`grid gap-3 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
    >
      {services.map((service) => (
        <div
          key={service.name}
          className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4"
        >
          <p className="text-sm font-medium text-slate-100">{service.name}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: accent }}>
            {service.price}
          </p>
          <p className="mt-2 text-base leading-relaxed text-slate-400">
            {service.blurb}
          </p>
        </div>
      ))}
    </div>
  );
}

function TestimonialsRow({
  testimonials,
}: {
  testimonials: MiniSiteContent["testimonials"];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {testimonials.map((item) => (
        <div
          key={item.name}
          className="rounded-[22px] border border-white/5 bg-white/[0.03] p-4"
        >
          <p className="text-base leading-relaxed text-slate-300">
            “{item.quote}”
          </p>
          <p className="mt-3 text-sm font-medium text-slate-400">
            — {item.name}
          </p>
        </div>
      ))}
    </div>
  );
}

function TrustStrip({
  signals,
  accent,
}: {
  signals: string[];
  accent: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <span
          key={signal}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-slate-300"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {signal}
        </span>
      ))}
    </div>
  );
}

function FooterBand({
  content,
  accent,
}: {
  content: MiniSiteContent;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-100">{content.business}</p>
          <p className="mt-1 text-sm text-slate-400">
            {content.footerNote ??
              `Call ${content.phone} · Licensed · Local · Ready this week`}
          </p>
        </div>
        <div
          className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-black"
          style={{ backgroundColor: accent }}
        >
          {content.cta}
        </div>
      </div>
    </div>
  );
}

function CtaButton({
  label,
  accent,
  darkText,
}: {
  label: string;
  accent: string;
  darkText?: boolean;
}) {
  return (
    <div
      className={`inline-flex rounded-full px-5 py-3 text-sm font-semibold ${darkText ? "text-black" : "text-white"}`}
      style={{ backgroundColor: accent }}
    >
      {label}
    </div>
  );
}

function GhostButton({ label }: { label: string }) {
  return (
    <div className="inline-flex rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-slate-100">
      {label}
    </div>
  );
}
