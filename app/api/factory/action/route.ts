import { NextRequest, NextResponse } from "next/server";
import { applyFactoryAction } from "@/lib/factory/actions";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const body = (await req.json()) as Record<string, string>;
    const op = String(body.op || "");
    if (!body.hostOrigin && !body.origin) {
      const derived =
        process.env.DEPLOY_PRIME_URL ||
        process.env.URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        req.nextUrl?.origin ||
        "";
      if (derived) body.hostOrigin = derived;
    }
    const result = await applyFactoryAction(op, body);
    if (!result.ok) {
      const status = result.status && result.status >= 400 && result.status < 500 ? result.status : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    return factoryErrorResponse(err, "Action failed");
  }
}
