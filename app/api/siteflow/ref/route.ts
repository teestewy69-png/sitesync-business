import { NextRequest, NextResponse } from "next/server";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { normalizeRefCode, REF_COOKIE, refWindowDays, safeNextPath } from "@/lib/siteflow/ref";
import { activePartner } from "@/lib/siteflow/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Middleware sends `?ref=<code>` visits here. A code that matches an active partner in the partners
 * collection sets the HttpOnly `sf_ref` cookie for SITEFLOW_REF_WINDOW_DAYS (last valid click wins);
 * anything else is dropped. Either way the visitor lands on the clean URL (same-site paths only).
 */
export async function GET(req: NextRequest) {
  ensureBlobsFromRequest(req);
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), { status: 307 });
  res.headers.set("cache-control", "no-store");
  res.headers.set("x-robots-tag", "noindex");
  const code = normalizeRefCode(req.nextUrl.searchParams.get("code"));
  if (!code) return res;
  try {
    const partner = await activePartner(code);
    if (partner) {
      res.cookies.set(REF_COOKIE, partner.code, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.nextUrl.protocol === "https:",
        path: "/",
        maxAge: refWindowDays() * 86_400,
      });
    }
  } catch (err) {
    console.warn("Ref validation failed:", err instanceof Error ? err.name : "unknown");
  }
  return res;
}
