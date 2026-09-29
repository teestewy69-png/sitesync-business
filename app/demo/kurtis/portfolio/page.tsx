import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selected works | Kurtis",
  description: "Portfolio grid of selected works for the internal Kurtis artist preview. noindex.",
  robots: { index: false, follow: false },
};

const WORKS = [
  { title: "Night Field, 2024", medium: "Oil on linen" },
  { title: "Threshold Study", medium: "Mixed media" },
  { title: "Harbor Window", medium: "Acrylic" },
];

export default function KurtisPortfolio() {
  return (
    <article className="space-y-6">
      <h1 className="text-3xl font-light">Selected works</h1>
      <p className="max-w-2xl text-zinc-400">
        A short inventory of pieces so the SEO workspace can read titles, headings, and thin-vs-adequate copy on a
        portfolio route.
      </p>
      <ul className="grid gap-4 sm:grid-cols-3">
        {WORKS.map((work) => (
          <li key={work.title} className="border border-white/10 p-4">
            <h2 className="text-lg">{work.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{work.medium}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
