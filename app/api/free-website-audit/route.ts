import { NextRequest, NextResponse } from "next/server";
import { auditUrl } from "@/lib/site-audit";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Free website audit: POST { url } -> seven plain checks on that one public page. Read-only; stores nothing. */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`audit:${clientKey(req)}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many checks from this connection. Please wait a few minutes and try again." }, { status: 429 });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Enter your website address, like joesplumbing.com." }, { status: 400 });
  }
  const url = typeof (body as { url?: unknown })?.url === "string" ? ((body as { url: string }).url) : "";
  const result = await auditUrl(url);
  return NextResponse.json(result, { status: result.ok ? 200 : 422, headers: { "cache-control": "no-store" } });
}
