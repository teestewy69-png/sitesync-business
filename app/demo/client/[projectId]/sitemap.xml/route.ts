import { NextRequest } from "next/server";
import { approvedEntries } from "@/lib/factory/city-launch-public";
import { readCityIndex } from "@/lib/factory/city-launch";
import { configFromProject } from "@/lib/factory/client-config";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { findProjectById } from "@/lib/store";
import { requestOrigin } from "@/lib/factory/request-origin";
import { clientSitemapUrls, loadPublishedPages } from "@/lib/factory/client-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Client sitemap: home, seeded template pages, locations index, every APPROVED city page.
 *   default            -> preview URLs on this host (/demo/client/<id>/...)
 *   ?target=production -> the client's real domain (only what it serves), only after Tony's City Launch production sign-off
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  ensureBlobsFromRequest(req);
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  if (!project) return new Response("Not found", { status: 404 });
  const index = await readCityIndex(projectId);
  const cities = approvedEntries(index);
  const config = configFromProject(project);
  const seeded = (project.seededPages?.length ? project.seededPages : config.seededPages).filter((p) => p.slug !== "home");
  const production = req.nextUrl.searchParams.get("target") === "production";
  let urls: Array<{ loc: string; lastmod?: string }>;
  if (production) {
    if (index?.production?.status !== "signed_off" || !index.production.domain) {
      return new Response("Production sitemap is available after the City Launch production sign-off (and a selected domain).", { status: 409 });
    }
    // Exactly what the client domain serves (app/client-domain/[host]/sitemap.xml uses the same builder).
    urls = clientSitemapUrls(`https://${index.production.domain}`, await loadPublishedPages(projectId), cities);
  } else {
    const root = `${await requestOrigin()}/demo/client/${projectId}`;
    urls = [
      { loc: root },
      ...seeded.map((p) => ({ loc: `${root}/${p.slug}` })),
      { loc: `${root}/locations` },
      ...cities.map((c) => ({ loc: `${root}/locations/${c.slug}`, lastmod: c.approvedAt || c.updatedAt })),
    ];
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" } });
}
