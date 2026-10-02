import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "24/7 emergency plumber | Smith Plumbing & Heating",
  description: "Emergency plumber landing page demo. Internal noindex.",
  robots: { index: false, follow: false },
};

export default function SmithPlumbingEmergency() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">24/7 emergency plumber</h1>
      <p className="text-zinc-300">
        Burst pipe, no hot water, or a basement filling with water? This demo page is the emergency intent landing
        for Smith Plumbing & Heating.
      </p>
      <p className="text-zinc-300">Call (555) 123-4567. This route is noindex and is not submitted to Google.</p>
    </article>
  );
}
