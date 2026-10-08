import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { saveScreenshot } from "@/lib/factory/workspace";
import { StoreError, ensureBlobsFromRequest } from "@/lib/persistence";
import { asNonEmptyString } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
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
    // Bad input stays a 400; a store failure is a real 500 (or 409) so the upload is not reported as saved.
    return factoryErrorResponse(err, "Upload failed.", err instanceof StoreError ? 500 : 400);
  }
}
