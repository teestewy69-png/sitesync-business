import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Smith Plumbing & Heating",
  description:
    "Emergency plumber demo used internally by Sitesinc to test multi-site SEO Intelligence. This page is noindex.",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/demo/smith-plumbing", label: "Home" },
  { href: "/demo/smith-plumbing/emergency", label: "Emergency" },
  { href: "/demo/smith-plumbing/services", label: "Services" },
  { href: "/demo/smith-plumbing/contact", label: "Contact" },
];

export default function SmithPlumbingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100">
        Internal Sitesinc demo. noindex. Not a Google property.
      </p>
      <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link href="/demo/smith-plumbing" className="text-lg font-semibold">
          Smith Plumbing & Heating
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-zinc-300">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-16">{children}</main>
    </div>
  );
}
