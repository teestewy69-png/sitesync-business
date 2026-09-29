import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plumbing services | Smith Plumbing & Heating",
  description: "Leak detection, water heaters, and repair services. Internal noindex demo.",
  robots: { index: false, follow: false },
};

export default function SmithPlumbingServices() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Plumbing services</h1>
      <p className="text-zinc-300">Leak detection, water heater installation, and everyday repair work for local homes.</p>
      <h2 className="text-xl font-semibold">What we handle</h2>
      <ul className="list-disc space-y-1 pl-5 text-zinc-300">
        <li>Emergency drain and pipe repair</li>
        <li>Water heater replacement</li>
        <li>Fixture installs without a scare pitch</li>
      </ul>
    </article>
  );
}
