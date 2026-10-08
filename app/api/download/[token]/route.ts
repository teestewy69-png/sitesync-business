import { NextRequest, NextResponse } from "next/server";
import { siteflowEnabled, siteflowPausedResponse } from "@/lib/siteflow/flag";
import { ensureBlobsFromRequest } from "@/lib/persistence";
import { readPrivateFile } from "@/lib/siteflow/private-files";
import { downloadSigningSecret, verifyDownloadToken } from "@/lib/siteflow/tokens";
import { findOrderById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deny(status: number, message: string) {
  return new NextResponse(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

/** Signed, expiring download. Re-checks the order is still paid (refunded orders lose access). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  // SiteFlow is paused (Path A) unless SITEFLOW_ENABLED is set; middleware also 404s this path.
  if (!siteflowEnabled()) return siteflowPausedResponse();
  ensureBlobsFromRequest(req);
  const { token } = await ctx.params;
  const check = verifyDownloadToken(decodeURIComponent(token || ""), downloadSigningSecret());
  if (!check.ok) {
    return deny(
      check.reason === "expired" ? 410 : 403,
      check.reason === "expired"
        ? "This download link has expired. Reply to your order email for a fresh link."
        : "This download link is not valid."
    );
  }
  const { o: orderId, k: fileKey, f: filename } = check.payload;
  const order = await findOrderById(orderId);
  if (!order || (order.status !== "paid" && order.status !== "fulfilled")) {
    return deny(403, "This order does not have an active download.");
  }
  if (!order.fulfillment?.deliveries?.some((d) => d.fileKey === fileKey && d.state === "ready")) {
    return deny(404, "File not found for this order.");
  }
  const file = await readPrivateFile(fileKey);
  if (!file) return deny(404, "File not found.");
  const safeName = filename.replace(/[^a-z0-9._-]/gi, "_").slice(0, 100) || "download";
  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
    },
  });
}
