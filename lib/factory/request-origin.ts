import { headers } from "next/headers";

/** Origin of the current request (for absolute URLs in canonical / JSON-LD / sitemap on the preview host). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "127.0.0.1:3000";
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
