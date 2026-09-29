import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exhibitions | Kurtis",
  description: "Exhibition list for the internal Kurtis portfolio preview. noindex.",
  robots: { index: false, follow: false },
};

export default function KurtisExhibitions() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-light">Exhibitions</h1>
      <ul className="space-y-3 text-zinc-300">
        <li>
          <h2 className="text-lg">Group show — 2025</h2>
          <p className="text-sm text-zinc-500">Placeholder venue. Dates not claimed as live press.</p>
        </li>
        <li>
          <h2 className="text-lg">Studio open hours</h2>
          <p className="text-sm text-zinc-500">Internal preview copy only.</p>
        </li>
      </ul>
    </article>
  );
}
