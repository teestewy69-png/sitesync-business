import type { MetadataRoute } from "next";
import { isPreviewEnv } from "@/lib/factory/preview";

export default function robots(): MetadataRoute.Robots {
  if (isPreviewEnv()) {
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
