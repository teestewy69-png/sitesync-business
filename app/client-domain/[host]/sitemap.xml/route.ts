import { NextRequest } from "next/server";
import { clientSitemapUrls, resolveClientRequest, sitemapXml, loadPublishedPages } from "@/lib/factory/client-domain";
import { approvedEntries } from "@/lib/factory/city-launch-public";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /sitemap.xml on the client's real domain: home, approved pages, locations index, approved city pages. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ host: string }> }) {
  ensureBlobsFromRequest(req);
  const { host } = await params;
  const r = await resolveClientRequest(host, req.headers.get("host") || req.headers.get("x-forwarded-host"), req.headers.get("x-sitesinc-client-host"));
  if (r.kind === "not_found") return new Response("Not found", { status: 404 });
  if (r.kind === "redirect") return Response.redirect(`${r.to}/sitemap.xml`, 308);
  const urls = clientSitemapUrls(r.site.origin, await loadPublishedPages(r.site.project.id), approvedEntries(r.site.index));
  return new Response(sitemapXml(urls), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
