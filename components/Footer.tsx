import content from "@/content.json";
import { SITE_COMPARE_LINKS, SITE_HASH_LINKS, SITE_HUB_LINKS, SITE_NAV } from "@/lib/site-nav";

const colHeading = "text-xs font-semibold uppercase tracking-wider text-slate-500";
const colLink = "text-sm text-slate-300 transition hover:text-brand-300";
const colItem = "py-1";

/**
 * Calm footer: the same destinations as before, organized into headed
 * columns instead of one wrapping link cloud. (Declutter pass, 2026-11-25.)
 */
export default function Footer() {
  const { site, footer } = content;

  return (
    <footer className="border-t border-white/5 bg-black py-14 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {/* The logo lockup already contains the SitesInc wordmark */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={site.name}
              className="h-10 w-auto rounded-md ring-1 ring-white/10"
            />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-400">
              {footer.trustTitle} {footer.trustLine}
            </p>
            <address className="mt-5 text-sm not-italic leading-relaxed text-slate-400">
              {footer.address.street}
              <br />
              {footer.address.city}, {footer.address.region} {footer.address.postalCode}
            </address>
            <p className="mt-5 space-y-1 text-sm text-slate-400">
              <span className="block">
                Email:{" "}
                <a href={`mailto:${footer.email}`} className="text-brand-300 hover:underline">
                  {footer.email}
                </a>
              </span>
              <span className="block">
                Phone:{" "}
                <a href={footer.phoneHref} className="text-brand-300 hover:underline">
                  {footer.phone}
                </a>
              </span>
              <span className="block">
                Reviews:{" "}
                <a
                  href={footer.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 hover:underline"
                >
                  Leave us a Google review
                </a>
              </span>
            </p>
          </div>

          <nav aria-label="Pages">
            <p className={colHeading}>Pages</p>
            <ul className="mt-4">
              {SITE_NAV.map((link) => (
                <li key={link.href} className={colItem}>
                  <a href={link.href} className={colLink}>
                    {link.label}
                  </a>
                </li>
              ))}
              <li className={colItem}>
                <a href="/blog" className={colLink}>
                  Blog
                </a>
              </li>
              <li className={colItem}>
                <a href="/free-website-audit" className={colLink}>
                  Free Audit
                </a>
              </li>
              <li className={colItem}>
                <a href="/store" className={colLink}>
                  Store
                </a>
              </li>
              {SITE_HASH_LINKS.map((link) => (
                <li key={link.href} className={colItem}>
                  <a href={link.href} className={colLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Services">
            <p className={colHeading}>Services</p>
            <ul className="mt-4">
              {SITE_HUB_LINKS.map((link) => (
                <li key={link.href} className={colItem}>
                  <a href={link.href} className={colLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Resources">
            <p className={colHeading}>Resources</p>
            <ul className="mt-4">
              <li className={colItem}>
                <a href="/free-book" className={colLink}>
                  Free ebook: What Your Web Builder Won&apos;t Tell You
                </a>
              </li>
              <li className={colItem}>
                <a href="/free-guide" className={colLink}>
                  Free guide: the 7 basics that get visitors to call
                </a>
              </li>
              <li className={colItem}>
                <a href="/giveaway" className={colLink}>
                  Website giveaway
                </a>
              </li>
              <li className={colItem}>
                <a href="/start" className={colLink}>
                  Free starter checklist
                </a>
              </li>
              {SITE_COMPARE_LINKS.map((link) => (
                <li key={link.href} className={colItem}>
                  <a href={link.href} className={colLink}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/5 pt-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {footer.legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {footer.legalLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition hover:text-brand-300">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
