import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AffiliateDisclosure from "@/components/siteflow/AffiliateDisclosure";
import { AFFILIATE_PROGRAMS, outboundHref, SPONSORED_REL, toolsPageListed } from "@/lib/affiliates";
import { siteflowEnabled } from "@/lib/siteflow/flag";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!siteflowEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: "Tools we use | Sitesinc",
    description: "Domain registrars and tools Sitesinc works with.",
    // Unlisted (noindex, not in the sitemap or navigation) until Tony picks affiliate programs.
    robots: toolsPageListed() ? undefined : { index: false, follow: false },
  };
}

export default function ToolsPage() {
  // Affiliate links are paused with SiteFlow (Path A): no /tools page at all.
  if (!siteflowEnabled()) notFound();
  const registrars = AFFILIATE_PROGRAMS.filter((p) => p.category === "registrar");
  const tools = AFFILIATE_PROGRAMS.filter((p) => p.category === "tool");
  const group = (title: string, list: typeof AFFILIATE_PROGRAMS) =>
    list.length ? (
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <li key={p.slug} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <a href={outboundHref("", p.slug, { src: "tools" })} rel={SPONSORED_REL} target="_blank" className="font-semibold text-brand-300 hover:underline">
                {p.name}
              </a>
              <p className="mt-1 text-sm text-slate-400">{p.blurb}</p>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-black px-6 py-16 text-white">
      <h1 className="text-3xl font-semibold tracking-tight">Tools we use</h1>
      <p className="mt-3 text-base text-slate-300">
        Where we send clients to register domains. You buy and own the domain yourself; Sitesinc never registers it for you.
      </p>
      <AffiliateDisclosure className="mt-3" />
      {group("Domain registrars", registrars)}
      {group("Tools", tools)}
    </main>
  );
}
