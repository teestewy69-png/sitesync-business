import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/factory/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
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
    const bytes = await readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(Uint8Array.from(bytes), {
      headers: {
        "content-type": type,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
}
