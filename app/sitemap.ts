import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/factory/pipeline";
import { anythingPurchasable } from "@/lib/public-catalog";
import { isStagingEnv } from "@/lib/site-env";

export const dynamic = "force-dynamic";

const BLOCKED = new Set(["/cart", "/checkout", "/thank-you", "/case-study", "/app"]);

/**
 * Path A: the public offer is the website build + optional monitoring. While nothing is purchasable (SiteFlow
 * paused), the inquiry-only /shop pages stay reachable but are noindex and left out of the sitemap.
 */
function isShopPath(path: string): boolean {
  return path === "/shop" || path.startsWith("/shop/");
}

export default function sitemap(): MetadataRoute.Sitemap {
  if (isStagingEnv()) return [];
  const origin = "https://sitesinc.co";
  const commerce = anythingPurchasable();
  const paths = PUBLIC_PATHS.filter(
    (path) => !BLOCKED.has(path) && !path.startsWith("/app") && (commerce || !isShopPath(path))
  );
  return paths.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
