import { NextRequest } from "next/server";
import { resolveClientRequest } from "@/lib/factory/client-domain";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /robots.txt on the client's real domain: indexable, points at the client's own sitemap. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ host: string }> }) {
  ensureBlobsFromRequest(req);
  const { host } = await params;
  const r = await resolveClientRequest(host, req.headers.get("host") || req.headers.get("x-forwarded-host"), req.headers.get("x-sitesinc-client-host"));
  if (r.kind === "not_found") return new Response("Not found", { status: 404 });
  if (r.kind === "redirect") return Response.redirect(`${r.to}/robots.txt`, 308);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${r.site.origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
