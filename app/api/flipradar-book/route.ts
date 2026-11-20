import { NextRequest, NextResponse } from "next/server";
import { handleFlipRadarSignup } from "@/lib/free-book";
import { ensureBlobsFromRequest } from "@/lib/store";
import { asNonEmptyString } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FlipRadar free-ebook capture: POST { name, email, businessKind? } from the
 * static flipradar.co site (no backend of its own), delivering "Your First
 * Flip". Saves one lead per email (source "lead-magnet-flipradar") in the
 * same CRM store as every other lead; the core flow lives in lib/free-book.ts.
 *
 * This is the ONLY capture route that accepts cross-origin calls, and only
 * from FlipRadar's own origins (apex + www). Responses carry
 * Access-Control-Allow-Origin for those origins only; requests from any
 * other origin get no CORS grant (the browser blocks the read) — same-origin
 * sitesinc.co behavior is unchanged.
 */
const ALLOWED_ORIGINS = new Set(["https://flipradar.co", "https://www.flipradar.co"]);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  try {
    ensureBlobsFromRequest(req);
    const limited = rateLimit(`flipradar-book:${clientKey(req)}`, 5, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429, headers: cors }
      );
    }

    const body = await readBody(req);
    if (asNonEmptyString(body?.company_website, 80)) {
      // Honeypot filled: pretend success, save nothing.
      return NextResponse.json({ ok: true }, { headers: cors });
    }

    const result = await handleFlipRadarSignup(body, req.nextUrl?.origin);
    return NextResponse.json(result.body, { status: result.status, headers: cors });
  } catch (err) {
    console.error(
      "FlipRadar book signup error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json(
      { ok: false, error: "We couldn't save that signup. Please try again in a minute." },
      { status: 502, headers: cors }
    );
  }
}
