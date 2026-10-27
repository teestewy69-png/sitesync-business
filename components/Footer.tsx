import content from "@/content.json";
import { SITE_COMPARE_LINKS, SITE_HASH_LINKS, SITE_NAV } from "@/lib/site-nav";

export default function Footer() {
  const { site, footer } = content;

  return (
    <footer className="relative border-t border-white/5 bg-black py-8 text-white">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-surface-elevated/60 via-transparent to-transparent" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-base">
        <div className="space-y-2">
          {/* The logo lockup already contains the Sitesinc wordmark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={site.name}
            className="h-14 w-auto rounded-lg ring-1 ring-white/10 sm:h-16"
          />
          <p className="text-sm text-slate-400 sm:text-sm">
            © {new Date().getFullYear()} {footer.legalName}. All rights
            reserved.
          </p>
          <p className="text-sm text-slate-400 sm:text-sm">
            Email:{" "}
            <a
              href={`mailto:${footer.email}`}
              className="text-brand-300 hover:underline"
            >
              {footer.email}
            </a>
          </p>
          <p className="text-sm text-slate-400 sm:text-sm">
            Phone:{" "}
            <a href={footer.phoneHref} className="text-brand-300 hover:underline">
              {footer.phone}
            </a>
          </p>
          <address className="text-sm not-italic text-slate-400 sm:text-sm">
            {footer.address.street}, {footer.address.city}, {footer.address.region}{" "}
            {footer.address.postalCode}
          </address>
        </div>

        <div className="space-y-1 text-sm text-slate-400 sm:text-base">
          <p className="font-medium text-slate-200">{footer.trustTitle}</p>
          <p>{footer.trustLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 sm:justify-end sm:text-base">
          {SITE_NAV.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-brand-300">
              {link.label}
            </a>
          ))}
          {SITE_COMPARE_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-brand-300">
              {link.label}
            </a>
          ))}
          {SITE_HASH_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-brand-300">
              {link.label}
            </a>
          ))}
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
