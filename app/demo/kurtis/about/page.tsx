import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Kurtis",
  description: "Biography page for the internal Kurtis artist-portfolio preview. noindex.",
  robots: { index: false, follow: false },
};

export default function KurtisAbout() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-light">About the studio</h1>
      <p className="max-w-2xl text-zinc-400">
        Kurtis works in painting and installation. This about page is a preview stand-in so SEO Intelligence can
        inspect artist-site copy without touching the live Kurtis domain or DNS.
      </p>
    </article>
  );
}
