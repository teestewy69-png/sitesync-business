import { NextRequest, NextResponse } from "next/server";
import { siteflowEnabled, siteflowPausedResponse } from "@/lib/siteflow/flag";
import { destinationUrl, getProgram, normalizeDomain } from "@/lib/affiliates";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { logClick } from "@/lib/siteflow/state";
import { newId } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Outbound partner redirect: log the click (no IP, no full referrer), then 302 to the destination. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  // SiteFlow is paused (Path A) unless SITEFLOW_ENABLED is set; middleware also 404s this path.
  if (!siteflowEnabled()) return siteflowPausedResponse();
  ensureBlobsFromRequest(req);
  const { slug } = await ctx.params;
  const program = getProgram(String(slug || "").toLowerCase());
  if (!program) return new NextResponse("Not found", { status: 404 });
  const domain = normalizeDomain(req.nextUrl.searchParams.get("d"));
  const src = (req.nextUrl.searchParams.get("src") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "direct";
  const { url, tracked } = destinationUrl(program, { domain });

  // Rate-limit logging (not the redirect) so a bot cannot flood the click log.
  if (rateLimit(`go:${clientKey(req)}`, 30, 60_000).ok) {
    let refererHost = "";
    try {
      refererHost = new URL(req.headers.get("referer") || "").host;
    } catch {
      refererHost = "";
    }
    const at = new Date().toISOString();
    await logClick({
      id: `${at.replace(/[^0-9]/g, "").slice(0, 14)}-${newId("clk")}`,
      slug: program.slug,
      at,
      src,
      ...(domain ? { domain } : {}),
      ...(refererHost ? { refererHost } : {}),
      tracked,
    }).catch((err) => console.warn("Click log failed:", err instanceof Error ? err.name : "unknown"));
  }
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" },
  });
}
