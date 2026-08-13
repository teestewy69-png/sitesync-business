import content from "@/content.json";

type ItemCta = {
  label: string;
  target?: string;
  href?: string;
};

export default function ProductTeaser() {
  const { productTeaser } = content;

  return (
    <section
      id="product"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-5xl space-y-8 px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
            {productTeaser.overline}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {productTeaser.title}
          </h2>
          <p className="text-sm text-slate-300 sm:text-base">
            {productTeaser.subtitle}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {productTeaser.items.map((item) => {
            const cta = item.cta as ItemCta | null;
            const href = cta?.href ?? (cta?.target ? `#${cta.target}` : null);
            const external = Boolean(cta?.href);

            return (
              <div
                key={item.name}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                  {item.status}
                </p>
                <h3 className="mt-2 text-base font-semibold text-slate-50">
                  {item.name}
                </h3>
                <p className="mt-2 flex-1 text-xs text-slate-400 sm:text-sm">
                  {item.detail}
                </p>
                {cta && href ? (
                  <a
                    href={href}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
                  >
                    {cta.label}
                  </a>
                ) : (
                  <p className="mt-5 text-xs font-medium text-slate-500">
                    Join the checklist list to hear when it drops.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
