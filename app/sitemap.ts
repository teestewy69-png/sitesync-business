import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/factory/pipeline";
import { isStagingEnv } from "@/lib/site-env";

export const dynamic = "force-dynamic";

const BLOCKED = new Set(["/cart", "/checkout", "/thank-you", "/case-study", "/app"]);

/**
 * The public offer is the website build + optional monitoring. There is no shop: /shop and /shop/* 301 to /
 * (middleware.ts) and are never listed. /cart and /checkout belong to paused SiteFlow and 404.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (isStagingEnv()) return [];
  const origin = "https://sitesinc.co";
  const paths = PUBLIC_PATHS.filter((path) => !BLOCKED.has(path) && !path.startsWith("/app"));
  return paths.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
