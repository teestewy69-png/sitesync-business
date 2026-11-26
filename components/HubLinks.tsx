import Link from "next/link";
import { SITE_HUB_LINKS } from "@/lib/site-nav";

const BLURBS: Record<(typeof SITE_HUB_LINKS)[number]["href"], string> = {
  "/website-design": "Affordable website design, $1,995 flat, code you own.",
  "/styles": "The eight layouts you pick from — live SitesInc previews, not client demos.",
  "/packages": "The build, the 50/50 invoices, and optional monitoring.",
  "/website-redesign": "When a rebuild is worth it, and when it is not.",
  "/seo-ready-websites": "What SEO for small business means on a SitesInc site.",
  "/website-monitoring": "Optional care after launch. The site works if you skip it.",
  "/for-local-service-businesses": "Website design for contractors, plumbers, and barbers.",
  "/inland-empire-small-business-website-design": "Inland Empire small business website design. $1,995 flat, you own it.",
  "/affordable-small-business-website-1995": "An affordable small business website for $1,995 flat. No rental trap.",
  "/rancho-cucamonga-small-business-web-design": "Web design for Rancho Cucamonga small businesses. $1,995 flat.",
};

/**
 * Quiet directory of the hub pages: plain links with a one-line blurb,
 * no cards or boxes. (Declutter pass, 2026-11-25 — was a 10-card grid.)
 */
export default function HubLinks({
  heading = "More about the $1,995 website build",
}: {
  heading?: string;
}) {
  return (
    <section className="border-t border-white/5 bg-black py-16 text-white">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h2>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          We build real, working websites, not subscriptions like the rest. Start with website design or packages,
          then read the pages that match how you work.
        </p>
        <ul className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_HUB_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-base font-semibold text-brand-300 hover:underline"
              >
                {link.label}
              </Link>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{BLURBS[link.href]}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
