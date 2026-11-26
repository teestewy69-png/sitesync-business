"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import content from "@/content.json";
import { SITE_NAV } from "@/lib/site-nav";

export default function SiteHeader({ variant = "page" }: { variant?: "page" | "hero" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { site } = content;
  const wrapClass =
    variant === "page" ? "border-b border-white/5 bg-black text-white" : "relative text-white";

  const linkClass = (href: string) =>
    `text-sm font-medium transition ${
      pathname === href ? "text-brand-300" : "text-slate-200 hover:text-brand-300"
    }`;

  return (
    <header className={wrapClass}>
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center" aria-label={`${site.name} home`}>
          <Image
            src="/logo.png"
            alt={`${site.name} logo`}
            width={192}
            height={96}
            priority={variant === "hero"}
            className="h-11 w-auto rounded-md ring-1 ring-white/10"
          />
        </Link>

        {/* Desktop: one quiet row of links + the single header CTA (phone). */}
        <div className="hidden items-center gap-7 lg:flex">
          {SITE_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}
          <a
            href="tel:+19093231575"
            data-analytics-cta="call"
            data-analytics-location="site_nav"
            className="rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:from-brand-200 hover:to-brand-500"
          >
            (909) 323-1575
          </a>
        </div>

        {/* Mobile: phone + menu button; links open in a calm vertical panel. */}
        <div className="flex items-center gap-3 lg:hidden">
          <a
            href="tel:+19093231575"
            data-analytics-cta="call"
            data-analytics-location="site_nav"
            className="rounded-full bg-gradient-to-b from-brand-300 to-brand-600 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:from-brand-200 hover:to-brand-500"
          >
            (909) 323-1575
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-100 ring-1 ring-white/15 transition hover:bg-white/5"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/5 px-6 py-4 lg:hidden">
          <ul className="space-y-1">
            {SITE_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block py-2.5 ${linkClass(item.href)}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
