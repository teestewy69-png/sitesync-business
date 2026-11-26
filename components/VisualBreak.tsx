import Image from "next/image";

/**
 * Mid-page visual break (redesign v2): one wide, calm photograph so the
 * homepage rhythm is not wall-to-wall text. The caption is the factual
 * service area from data/trades.ts — the photo is illustrative scenery,
 * not a client or a job site.
 */
export default function VisualBreak() {
  return (
    <section aria-label="The neighborhoods we build for" className="bg-black">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <figure>
          <div className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10">
            <Image
              src="/images/street-dusk.jpg"
              alt="A Southern California main street at dusk, small storefronts glowing warm"
              width={2352}
              height={1008}
              className="h-56 w-full object-cover sm:h-72 lg:h-80"
              sizes="(max-width: 1152px) 100vw, 1152px"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          </div>
          <figcaption className="mt-4 text-center text-sm text-slate-400">
            Built for the little guy on streets like this — Los Angeles, Orange,
            Riverside and San Bernardino counties.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
