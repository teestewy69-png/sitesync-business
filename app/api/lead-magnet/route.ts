import { NextRequest, NextResponse } from "next/server";
import { handleLeadMagnetSignup } from "@/lib/lead-magnet";
import { ensureBlobsFromRequest } from "@/lib/store";
import { asNonEmptyString } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lead magnet signup: POST { name, email, businessKind? } from /start.
 * Saves one lead per email (source "lead-magnet-start") in the CRM store and
 * emails The New Business Website Starter Checklist. The core flow lives in
 * lib/lead-magnet.ts; this wrapper only parses the body, drops honeypot
 * submissions, and rate-limits.
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
    const limited = rateLimit(`lead-magnet:${clientKey(req)}`, 5, 10 * 60 * 1000);
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

    const result = await handleLeadMagnetSignup(body, req.nextUrl?.origin);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error(
      "Lead magnet signup error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json(
      { ok: false, error: "We couldn't save that signup. Please try again in a minute." },
      { status: 502 }
    );
  }
}
