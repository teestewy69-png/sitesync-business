import { NextRequest, NextResponse } from "next/server";
import { readClientAsset } from "@/lib/factory/client-content-store";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read of an uploaded client image, so the (public, noindex) client preview can show it.
 * Only files still listed on the client's workspace are served; ids are unguessable store names.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string; file: string }> }) {
  const { projectId, file } = await context.params;
  try {
    ensureBlobsFromRequest(req);
    const found = await readClientAsset(projectId, file);
    if (!found) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return new NextResponse(Uint8Array.from(found.bytes), {
      headers: {
        "content-type": found.contentType,
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read file." }, { status: 500 });
  }
}
