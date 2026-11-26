import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import SitePage from "@/components/SitePage";
import { FREE_BOOK_PDF_PATH, GUIDE } from "@/lib/free-book";
import type { GuideBlock } from "@/data/free-book-guide";
import content from "@/content.json";

export const metadata: Metadata = {
  title: "What Your Web Builder Won't Tell You | SitesInc",
  description:
    "The hidden costs of a website — the full fee stack, a three-year true-cost worksheet, three worked comparisons, red flags, and the 10 questions to ask any builder before you sign.",
  robots: { index: false, follow: false },
};

/** Render the guide's markdown-lite inline markers (**bold**, *italic*). */
function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return <span key={i}>{part}</span>;
    });
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return <p className="mt-4 text-base leading-relaxed text-slate-300">{renderInline(block.text)}</p>;
    case "h3":
      return <h3 className="mt-8 text-xl font-semibold">{renderInline(block.text)}</h3>;
    case "list":
      return (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-200 marker:text-brand-300">
          {block.items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "checklist":
      return (
        <ul className="mt-4 space-y-3">
          {block.items.map((item) => (
            <li
              key={item}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-200"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-brand-300/70"
              />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    className="border-b border-white/15 px-3 py-2 font-semibold text-slate-100"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="border-b border-white/5 px-3 py-2 align-top text-slate-300"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return (
        <blockquote className="mt-6 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-6 text-base leading-relaxed text-slate-100">
          {renderInline(block.text)}
        </blockquote>
      );
  }
}

export default function FreeBookGuidePage() {
  return (
    <SitePage>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
          Free ebook
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{GUIDE.title}</h1>
        <p className="mt-2 text-base text-slate-400">{GUIDE.subtitle}</p>
        <p className="mt-4 text-base text-slate-300">
          {GUIDE.brandLine} — {GUIDE.audience}
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-200">
          {renderInline(GUIDE.honestNote)}
        </div>

        <p className="mt-6">
          <a
            href={FREE_BOOK_PDF_PATH}
            className="inline-flex rounded-xl border border-brand-300/50 px-5 py-2.5 text-sm font-semibold text-brand-200 transition hover:bg-brand-500/10"
          >
            Download the PDF copy
          </a>
        </p>

        {GUIDE.chapters.map((chapter) => (
          <div key={chapter.heading}>
            <h2 className="mt-12 text-2xl font-semibold">{chapter.heading}</h2>
            {chapter.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        ))}

        <div className="mt-12 rounded-2xl border border-brand-300/30 bg-brand-500/10 p-6 text-sm leading-relaxed text-slate-200">
          {renderInline(GUIDE.closing[0])}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          {renderInline(GUIDE.closing[1])}
        </p>

        <p className="mt-8 text-sm text-slate-400">
          Didn&apos;t sign up yet?{" "}
          <Link href="/free-book" className="font-medium text-brand-300 hover:underline">
            Get the ebook by email
          </Link>{" "}
          so you can keep it. Questions: {content.footer.email} · {content.footer.phone}
        </p>
      </section>
    </SitePage>
  );
}
