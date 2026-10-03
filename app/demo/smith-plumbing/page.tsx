import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smith Plumbing & Heating | Emergency plumber demo",
  description: "Call-first homepage demo for a local emergency plumber. Internal noindex test site.",
  robots: { index: false, follow: false },
};

export default function SmithPlumbingHome() {
  return (
    <article className="space-y-6">
      <h1 className="text-4xl font-semibold tracking-tight">Fast, reliable plumbing help when you need it most.</h1>
      <p className="max-w-2xl text-lg text-zinc-300">
        Smith Plumbing & Heating is a local emergency plumber demo. Call-first homepage, 24/7 service focus, and a
        tap-to-call CTA.
      </p>
      <p>
        <a href="tel:+15551234567" className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-zinc-950">
          Request Emergency Service
        </a>
      </p>
      <ul className="list-disc space-y-1 pl-5 text-zinc-300">
        <li>24/7 Emergency Plumbing</li>
        <li>Leak Detection & Repair</li>
        <li>Water Heater Installation</li>
      </ul>
    </article>
  );
}
