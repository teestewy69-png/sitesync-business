import { NextRequest, NextResponse } from "next/server";
import { handleGiveawayEntry } from "@/lib/giveaway";
import { ensureBlobsFromRequest } from "@/lib/store";
import { asNonEmptyString } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Giveaway entry: POST { name, email, businessName, businessKind? } from
 * /giveaway. Saves one entry per email (source "giveaway-2026") in the CRM
 * store and emails the entry confirmation. The core flow lives in
 * lib/giveaway.ts; this wrapper only parses the body, drops honeypot
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
    const limited = rateLimit(`giveaway:${clientKey(req)}`, 5, 10 * 60 * 1000);
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

    const result = await handleGiveawayEntry(body, req.nextUrl?.origin);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error(
      "Giveaway entry error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json(
      { ok: false, error: "We couldn't save that entry. Please try again in a minute." },
      { status: 502 }
    );
  }
}
