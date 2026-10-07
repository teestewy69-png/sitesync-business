import { Check } from "lucide-react";
import content from "@/content.json";

export default function Outcomes() {
  const { outcomes } = content;

  return (
    <section id="outcomes" className="border-t border-white/5 bg-black py-16 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{outcomes.title}</h2>
          <p className="text-base text-slate-300">{outcomes.subtitle}</p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {outcomes.items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-brand-400/60 hover:bg-brand-500/5"
            >
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-50 sm:text-base">{item.title}</h3>
                  <p className="text-base text-slate-300">{item.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
