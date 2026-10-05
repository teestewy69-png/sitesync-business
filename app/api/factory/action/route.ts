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
    const result = await applyFactoryAction(op, body);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return factoryErrorResponse(err, "Action failed");
  }
}
