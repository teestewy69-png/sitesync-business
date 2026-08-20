import { processSteps } from "@/data/process";

export default function Process() {
  return (
    <section
      id="process"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works.
            <span className="block text-lg font-normal text-slate-300 sm:text-xl">
              From &ldquo;no real website&rdquo; to &ldquo;money-ready
              site&rdquo; in under a week.
            </span>
          </h2>
          <p className="text-base text-slate-300">
            The whole process is built for busy small business owners. You
            don&apos;t need to know anything about code, hosting, or SEO&mdash;we
            handle it for you.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {processSteps.map((s) => (
            <div
              key={s.step}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-brand-400/60 hover:bg-brand-500/5"
            >
              <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-brand-500/10 opacity-0 blur-3xl transition group-hover:opacity-100" />
              <div className="relative space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs uppercase tracking-wider text-slate-300">
                  <span className="font-mono text-brand-300">{s.step}</span>
                  <span className="h-1 w-1 rounded-full bg-brand-400" />
                  <span>Step</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-50 sm:text-base">
                  {s.title}
                </h3>
                <p className="text-base text-slate-300">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
