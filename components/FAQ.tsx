import { faqItems } from "@/data/faq";

export default function FAQ() {
  return (
    <section
      id="faq"
      className="relative border-t border-white/5 bg-gradient-to-b from-black via-canvas to-black py-16 text-white sm:py-20"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-500/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-5xl px-6">
        <div className="mb-8 max-w-xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Questions small business owners actually ask.
          </h2>
          <p className="text-base text-slate-300">
            No tech jargon, no hidden fees. Just clear answers about how your
            website is built, what you pay, and what you get.
          </p>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, idx) => (
            <div
              key={item.question}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-base text-slate-200 backdrop-blur"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                Q{String(idx + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-50 sm:text-base">
                {item.question}
              </h3>
              <p className="mt-2 text-base text-slate-300">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
