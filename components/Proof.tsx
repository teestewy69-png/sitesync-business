import content from "@/content.json";
import BuildDemo from "@/components/BuildDemo";

export default function Proof() {
  const { proof } = content;

  return (
    <section
      id="proof"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-5xl space-y-10 px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
            {proof.overline}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {proof.title}
          </h2>
          <p className="text-base text-slate-300">{proof.subtitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {proof.outcomes.map((outcome) => (
            <div
              key={outcome.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <p className="text-2xl font-semibold tracking-tight text-brand-300 sm:text-3xl">
                {outcome.stat}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-50">
                {outcome.label}
              </p>
              <p className="mt-2 text-base text-slate-400">
                {outcome.detail}
              </p>
            </div>
          ))}
        </div>

        <BuildDemo />

        <div className="flex justify-start">
          <a
            href={`#${proof.cta.target}`}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-glow transition hover:from-brand-200 hover:to-brand-500"
          >
            {proof.cta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
