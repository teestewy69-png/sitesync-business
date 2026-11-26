import Image from "next/image";
import Link from "next/link";
import { DESIGN_STYLES } from "@/lib/design-styles";

/**
 * Homepage designs section (redesign v2). Replaces the auto-rotating
 * preview with a calm grid of real rendered thumbnails — each image is a
 * screenshot of the actual layout rendering the live sitesinc.co offer
 * (the same previews served at /styles/[id]), not a mockup or a client
 * site. Clicking a card opens that layout's full live preview.
 */
export default function DesignShowcase() {
  return (
    <section
      id="designs"
      className="border-t border-white/5 bg-black py-16 text-white sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            8 designs
          </h2>
          <p className="text-base text-slate-300">
            Ultra-modern layouts with different structure and personality —
            each one shown here is the live sitesinc.co offer in that layout,
            not a fake demo client.
          </p>
          <p className="text-sm text-slate-400">
            <Link href="/styles" className="font-medium text-brand-300 hover:underline">
              See all 8 layouts on one page
            </Link>
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DESIGN_STYLES.map((design) => (
            <Link
              key={design.id}
              href={`/styles/${design.id}`}
              data-analytics-cta="design_card"
              data-analytics-location={`home_design_${design.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-brand-400/60 hover:bg-brand-400/5"
            >
              <Image
                src={`/images/designs/${design.id}.jpg`}
                alt={`The ${design.name} layout showing the live SitesInc offer`}
                width={880}
                height={660}
                className="aspect-[4/3] w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              <div className="flex items-center gap-2.5 p-4">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: design.accent }}
                />
                <p className="text-sm font-semibold text-white">{design.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
