import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/factory/pipeline";

export const dynamic = "force-dynamic";

const BLOCKED = new Set(["/cart", "/checkout", "/thank-you", "/case-study", "/app"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = "https://sitesinc.co";
  const paths = PUBLIC_PATHS.filter((path) => !BLOCKED.has(path) && !path.startsWith("/app"));
  return paths.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
