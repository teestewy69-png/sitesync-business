import Link from "next/link";
import MiniSiteFrame from "@/components/MiniSiteFrame";
import { SITESINC_SITE, type DesignStyle } from "@/lib/design-styles";

const THUMB_SCALE = 0.42;

export default function StylePreviewCard({ style }: { style: DesignStyle }) {
  return (
    <Link
      href={`/styles/${style.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition hover:border-brand-400/50 hover:bg-white/[0.05]"
    >
      <div className="relative h-64 overflow-hidden border-b border-white/10 bg-black/40 sm:h-72">
        <div
          aria-hidden
          className="pointer-events-none origin-top-left p-3"
          style={{
            transform: `scale(${THUMB_SCALE})`,
            width: `${100 / THUMB_SCALE}%`,
          }}
        >
          <MiniSiteFrame style={style} content={SITESINC_SITE} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" />
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-950"
          style={{ backgroundColor: style.accent }}
        >
          {style.name}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h2 className="text-lg font-semibold tracking-tight text-white">{style.name}</h2>
        <p className="text-sm leading-relaxed text-slate-300">{style.blurb}</p>
        <span className="mt-auto pt-3 text-sm font-medium text-brand-300 group-hover:underline">
          View full layout →
        </span>
      </div>
    </Link>
  );
}
