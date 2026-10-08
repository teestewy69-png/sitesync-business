import type { PreviewWork } from "@/lib/factory/client-content";

/** Client-supplied works with their images (text captions only; prices appear only when the pricing note allows). */
export default function ClientWorksGrid({ works, className = "" }: { works: PreviewWork[]; className?: string }) {
  if (!works.length) return null;
  return (
    <ul className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {works.map((work) => (
        <li key={work.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {work.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- client uploads are served from the factory store, not /public
            <img src={work.image.src} alt={work.image.alt} loading="lazy" className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-black/30 px-4 text-center text-xs italic text-amber-200/80">
              [Image not supplied yet]
            </div>
          )}
          <div className="p-3">
            <p className="text-sm font-semibold text-white">{work.title}</p>
            {work.series ? <p className="text-xs text-zinc-400">{work.series}</p> : null}
            {work.caption ? <p className="mt-1 text-xs text-zinc-300">{work.caption}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
