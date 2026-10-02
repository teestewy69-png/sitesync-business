import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kurtis",
  description: "Artist portfolio preview used internally by Sitesinc SEO Intelligence. noindex.",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/demo/kurtis", label: "Home" },
  { href: "/demo/kurtis/portfolio", label: "Selected works" },
  { href: "/demo/kurtis/about", label: "About" },
  { href: "/demo/kurtis/exhibitions", label: "Exhibitions" },
  { href: "/demo/kurtis/contact", label: "Contact" },
];

export default function KurtisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <p className="border-b border-white/10 bg-white/5 px-4 py-2 text-center text-xs text-zinc-400">
        Internal artist-portfolio preview. noindex. Not the live Kurtis site. Not a Google property.
      </p>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <Link href="/demo/kurtis" className="text-lg tracking-[0.2em] uppercase">
          Kurtis
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-zinc-400">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-20">{children}</main>
    </div>
  );
}
