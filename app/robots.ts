import type { MetadataRoute } from "next";
import { isPreviewEnv } from "@/lib/factory/preview";
import { isStagingEnv } from "@/lib/site-env";

export default function robots(): MetadataRoute.Robots {
  if (isPreviewEnv() || isStagingEnv()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/api/", "/cart", "/checkout", "/case-study"],
      },
    ],
    sitemap: "https://sitesinc.co/sitemap.xml",
    host: "https://sitesinc.co",
  };
}
