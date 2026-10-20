import type { MetadataRoute } from "next";
import { PUBLIC_PATHS } from "@/lib/factory/pipeline";
import { readPublicWorkspace } from "@/lib/factory/workspace";
import { isStagingEnv } from "@/lib/site-env";

export const dynamic = "force-dynamic";

const BLOCKED = new Set(["/cart", "/checkout", "/thank-you", "/case-study", "/app"]);

/**
 * The public offer is the website build + optional monitoring. There is no shop: /shop and /shop/* 301 to /
 * (middleware.ts) and are never listed. /cart and /checkout belong to paused SiteFlow and 404.
 * Published factory hub pages are appended at runtime so the sitemap matches what actually 200s.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isStagingEnv()) return [];
  const origin = "https://sitesinc.co";
  const paths = new Set<string>(
    PUBLIC_PATHS.filter((path) => !BLOCKED.has(path) && !path.startsWith("/app"))
  );
  const workspace = await readPublicWorkspace();
  if (workspace) {
    for (const page of workspace.pages) {
      if (page.status !== "published" || page.noindex || !page.path || page.path === "/") continue;
      if (BLOCKED.has(page.path) || page.path.startsWith("/app")) continue;
      paths.add(page.path);
    }
  }
  return [...paths].map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
