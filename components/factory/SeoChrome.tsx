"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SEO_TABS, type SeoSiteOption } from "@/lib/factory/seo-nav";

export default function SeoChrome({ sites, selectedId }: { sites: SeoSiteOption[]; selectedId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function withSite(href: string) {
    const next = new URLSearchParams(params.toString());
    next.set("site", selectedId);
    return `${href}?${next.toString()}`;
  }

  return (
    <div className="mb-8 space-y-4">
      <p className="max-w-3xl text-sm text-slate-400">
        Protected SEO Intelligence workspace. Numbers come from the dated baseline crawl, factory
        preflight, operator indexing rows, and documented backlinks. Search Console counts are not
        invented. Client projects with a factory workspace appear as their own site (preview origin +
        client baseline). Sitesinc and demo fixtures are never borrowed for a client inventory.
      </p>
      <label className="block max-w-lg text-xs text-slate-400">
        Site
        <select
          value={selectedId}
          onChange={(event) => {
            const next = new URLSearchParams(params.toString());
            next.set("site", event.target.value);
            router.push(`${pathname}?${next.toString()}`);
          }}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name} · {site.origin}
            </option>
          ))}
        </select>
      </label>
      <nav className="flex flex-wrap gap-2">
        {SEO_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={withSite(tab.href)}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? "border-brand-400/60 bg-brand-500/10 text-white"
                  : "border-white/10 text-slate-300 hover:border-brand-400/50 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
