import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kurtis | Artist portfolio preview",
  description: "Studio homepage for an artist portfolio preview. Internal noindex test site.",
  robots: { index: false, follow: false },
};

export default function KurtisHome() {
  return (
    <article className="space-y-8">
      <h1 className="max-w-3xl text-4xl font-light tracking-tight sm:text-5xl">Work shown, not sold as a template.</h1>
      <p className="max-w-2xl text-lg text-zinc-400">
        Kurtis is an artist-portfolio preview for Sitesinc SEO Intelligence. This is a showcase homepage, not a
        local-service funnel and not the live production artist site.
      </p>
      <p className="text-sm uppercase tracking-widest text-zinc-500">Selected series · canvas · installation</p>
    </article>
  );
}
