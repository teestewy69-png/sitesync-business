import Link from "next/link";

/**
 * Homepage free-resources callout: the two free lead magnets, one tidy block.
 * The ebook (/free-book) is for comparison shoppers pricing a website; the
 * starter checklist (/start) is for people starting a business from zero.
 */
export default function FreeResources() {
  return (
    <section className="border-t border-white/5 bg-black py-14 text-white sm:py-16">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Two free reads before you spend anything
        </h2>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          No cost, no pitch call required. Take the one that matches where you are — both land
          in your inbox, and both tell you the truth about what a website should cost.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/free-book"
              className="block h-full rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/40 hover:bg-white/10"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                Free ebook
              </span>
              <span className="mt-1 block text-base font-semibold text-slate-100">
                What Your Web Builder Won&apos;t Tell You
              </span>
              <p className="mt-2 text-sm text-slate-300">
                Comparing builders or platforms? The 14 hidden costs behind the sticker price,
                a worksheet to calculate the real three-year cost of any quote, and the 10
                questions to ask before you sign.
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/start"
              className="block h-full rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/40 hover:bg-white/10"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                Free checklist
              </span>
              <span className="mt-1 block text-base font-semibold text-slate-100">
                The New Business Website Starter Checklist
              </span>
              <p className="mt-2 text-sm text-slate-300">
                Starting a business from zero? What to decide, what to gather, the pages you
                need, and the cost traps to step around — the same list we work through on
                every build.
              </p>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
