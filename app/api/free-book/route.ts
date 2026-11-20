import { NextRequest, NextResponse } from "next/server";
import { handleFreeBookSignup } from "@/lib/free-book";
import { ensureBlobsFromRequest } from "@/lib/store";
import { asNonEmptyString } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Free-ebook signup: POST { name, email, businessKind? } from /free-book.
 * Saves one lead per email (source "lead-magnet-free-book") in the CRM store
 * and emails "What Your Web Builder Won't Tell You". The core flow lives in
 * lib/free-book.ts; this wrapper only parses the body, drops honeypot
 * submissions, and rate-limits. Same-origin only — the FlipRadar capture
 * route (/api/flipradar-book) is the cross-origin one.
 */
async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const limited = rateLimit(`free-book:${clientKey(req)}`, 5, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await readBody(req);
    if (asNonEmptyString(body?.company_website, 80)) {
      // Honeypot filled: pretend success, save nothing.
      return NextResponse.json({ ok: true });
    }

    const result = await handleFreeBookSignup(body, req.nextUrl?.origin);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error(
      "Free book signup error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json(
      { ok: false, error: "We couldn't save that signup. Please try again in a minute." },
      { status: 502 }
    );
  }
}
