import { NextRequest, NextResponse } from "next/server";
import { saveScreenshot } from "@/lib/factory/workspace";
import { asNonEmptyString } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Choose a screenshot file." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > 4_000_000) {
      return NextResponse.json({ ok: false, error: "Keep screenshots under 4MB." }, { status: 400 });
    }
    const viewport = asNonEmptyString(form.get("viewport"), 20) === "mobile" ? "mobile" : "desktop";
    const ref = await saveScreenshot({
      name: file.name,
      bytes,
      viewport,
      label: asNonEmptyString(form.get("label"), 80),
    });
    return NextResponse.json({ ok: true, screenshot: ref });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
