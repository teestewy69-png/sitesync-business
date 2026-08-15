"use client";

import content from "@/content.json";
import { scrollToId } from "@/lib/scroll";

export default function Footer() {
  const { site, footer } = content;

  return (
    <footer className="relative border-t border-white/5 bg-black py-8 text-white">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-surface-elevated/60 via-transparent to-transparent" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        {/* Left: brand & rights */}
        <div className="space-y-2">
          {/* The logo lockup already contains the Sitesync wordmark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={site.name}
            className="h-10 w-auto rounded-lg ring-1 ring-white/10"
          />
          <p className="text-[11px] text-slate-500 sm:text-xs">
            © {new Date().getFullYear()} {footer.legalName}. All rights
            reserved.
          </p>
          <p className="text-[11px] text-slate-400 sm:text-xs">
            Email:{" "}
            <a
              href={`mailto:${footer.email}`}
              className="text-brand-300 hover:underline"
            >
              {footer.email}
            </a>
          </p>
        </div>

        {/* Middle: trust / security */}
        <div className="space-y-1 text-[11px] text-slate-400 sm:text-xs">
          <p className="font-medium text-slate-200">{footer.trustTitle}</p>
          <p>{footer.trustLine}</p>
        </div>

        {/* Right: quick links */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 sm:justify-end sm:text-xs">
          {footer.scrollLinks.map((link) => (
            <button
              key={link.target}
              type="button"
              className="transition hover:text-brand-300"
              onClick={() => scrollToId(link.target)}
            >
              {link.label}
            </button>
          ))}
          <a href="/shop" className="transition hover:text-brand-300">
            Shop
          </a>
          <a href="/blog" className="transition hover:text-brand-300">
            Blog
          </a>
          {footer.legalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition hover:text-brand-300"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
