import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { readScreenshot } from "@/lib/factory/workspace";
import { ensureBlobsFromRequest } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  const { name } = await context.params;
  if (!/^[a-z0-9_.-]+$/i.test(name)) {
    return NextResponse.json({ ok: false, error: "Invalid file." }, { status: 400 });
  }
  const ext = path.extname(name).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    return NextResponse.json({ ok: false, error: "Unsupported file." }, { status: 400 });
  }
  try {
    ensureBlobsFromRequest(req);
    const bytes = await readScreenshot(name);
    if (!bytes) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    return new NextResponse(Uint8Array.from(bytes), {
      headers: {
        "content-type": type,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return factoryErrorResponse(err, "Could not read file.");
  }
}
