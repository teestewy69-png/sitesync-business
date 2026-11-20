import { NextRequest, NextResponse } from "next/server";
import { deepAuditUrl } from "@/lib/deep-audit";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Free website audit, deep half: POST { url } -> a crawl of up to 10 pages by the SiteFlow audit
 * engine, with a 0-100 health score and grouped findings. Read-only; stores nothing. The crawl
 * costs real time and bandwidth, so the rate limit is tighter than the instant checks.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`deep-audit:${clientKey(req)}`, 3, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many deep audits from this connection. Please wait a few minutes and try again." }, { status: 429 });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Enter your website address, like joesplumbing.com." }, { status: 400 });
  }
  const url = typeof (body as { url?: unknown })?.url === "string" ? ((body as { url: string }).url) : "";
  const result = await deepAuditUrl(url);
  return NextResponse.json(result, { status: result.ok ? 200 : 422, headers: { "cache-control": "no-store" } });
}
