"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import content from "@/content.json";
import { SITE_NAV } from "@/lib/site-nav";

export default function SiteHeader({ variant = "page" }: { variant?: "page" | "hero" }) {
  const pathname = usePathname();
  const { site } = content;
  const wrapClass =
    variant === "page" ? "border-b border-white/5 bg-black text-white" : "relative text-white";

  return (
    <header className={wrapClass}>
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt={`${site.name} logo`}
            width={192}
            height={96}
            priority={variant === "hero"}
            className="h-20 w-auto rounded-lg ring-1 ring-white/10 sm:h-24"
          />
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-x-4">
          {SITE_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition ${
                  active ? "text-brand-300" : "text-slate-200 hover:text-brand-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/#pricing"
            data-analytics-cta="see_pricing"
            data-analytics-location="site_nav"
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            See pricing
          </Link>
        </div>
      </nav>
    </header>
  );
}
