import Link from "next/link";
import {
  PITCH_CTA,
  PITCH_DIAGNOSTIC_HREF,
  PITCH_EXISTING,
  PITCH_NEW_BUSINESS,
  PITCH_PHONE_HREF,
} from "@/lib/two-audience-pitch";

export default function TwoAudiencePitch({
  compact = false,
  location = "page",
}: {
  compact?: boolean;
  location?: string;
}) {
  const inner = (
    <div className={compact ? "" : "mx-auto max-w-3xl"}>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">Two ways to start</p>
      <p className={`mt-2 font-semibold tracking-tight text-white ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
        {PITCH_NEW_BUSINESS}
      </p>
      <p className="mt-3 text-base text-slate-300">
        <Link href={PITCH_DIAGNOSTIC_HREF} className="text-brand-300 hover:underline">
          {PITCH_EXISTING}
        </Link>
      </p>
      <p className="mt-4 text-base text-slate-100">
        <a
          href={PITCH_PHONE_HREF}
          data-analytics-cta="call"
          data-analytics-location={`pitch_${location}`}
          className="font-semibold text-brand-300 hover:underline"
        >
          {PITCH_CTA}
        </a>
      </p>
    </div>
  );

  if (compact) {
    return (
      <section className="rounded-2xl border border-brand-400/30 bg-brand-500/10 p-6">
        {inner}
      </section>
    );
  }

  return (
    <section className="border-t border-white/5 bg-gradient-to-r from-brand-900/40 via-black to-brand-900/40 py-12 text-white">
      <div className="mx-auto max-w-6xl px-6">{inner}</div>
    </section>
  );
}
