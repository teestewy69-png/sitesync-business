import { NextRequest, NextResponse } from "next/server";
import { siteflowEnabled, siteflowPausedResponse } from "@/lib/siteflow/flag";
import { getCatalogEntry } from "@/data/products";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { writePrivateFile } from "@/lib/siteflow/private-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;

/** Upload the static deliverable for a catalog entry (multipart: slug, file) into the private store. */
export async function POST(req: NextRequest) {
  // SiteFlow is paused (Path A) unless SITEFLOW_ENABLED is set; middleware also 404s this path.
  if (!siteflowEnabled()) return siteflowPausedResponse();
  try {
    ensureBlobsFromRequest(req);
    const form = await req.formData();
    const slug = String(form.get("slug") || "");
    const file = form.get("file");
    const entry = getCatalogEntry(slug);
    if (!entry || entry.deliverable?.type !== "file") {
      return NextResponse.json({ ok: false, error: "That catalog entry does not take an uploaded file." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "File is larger than 50 MB." }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await writePrivateFile(entry.deliverable.fileKey, bytes, file.type || "application/octet-stream");
    return NextResponse.json({ ok: true, fileKey: entry.deliverable.fileKey, bytes: bytes.byteLength });
  } catch (err) {
    return factoryErrorResponse(err, "Upload failed");
  }
}
