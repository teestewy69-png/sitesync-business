import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { clientAssetUrl, MAX_CLIENT_ASSET_BYTES } from "@/lib/factory/client-content";
import { ClientContentError, saveClientAsset } from "@/lib/factory/client-content-store";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { findProjectById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload one client image (factory auth via middleware). multipart/form-data:
 *   projectId, file (JPEG/PNG/WebP, max 4 MB), alt (required), role (work | artist-photo | logo | other).
 * Stored in the factory store (Netlify Blobs on Netlify, ./data locally). Same bytes twice = same asset.
 */
export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_CLIENT_ASSET_BYTES + 256_000) {
      return NextResponse.json(
        { ok: false, error: `File is too big. Keep images under ${MAX_CLIENT_ASSET_BYTES / 1_000_000} MB.` },
        { status: 413 }
      );
    }
    const form = await req.formData();
    const projectId = String(form.get("projectId") || "");
    const file = form.get("file");
    if (!projectId) return NextResponse.json({ ok: false, error: "projectId required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose an image file." }, { status: 400 });
    const project = await findProjectById(projectId);
    if (!project) return NextResponse.json({ ok: false, error: "Client project not found." }, { status: 404 });
    const { asset, deduped } = await saveClientAsset(
      projectId,
      {
        name: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
        alt: String(form.get("alt") || ""),
        role: String(form.get("role") || "work"),
      },
      String(form.get("approvedBy") || "operator")
    );
    return NextResponse.json({ ok: true, deduped, asset, url: clientAssetUrl(projectId, asset.filename) });
  } catch (err) {
    if (err instanceof ClientContentError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    return factoryErrorResponse(err, "Upload failed.");
  }
}
