import type { MetadataRoute } from "next";
import { isPreviewEnv } from "@/lib/factory/preview";
import { PUBLIC_NOINDEX_DISALLOWS } from "@/lib/public-noindex";
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
        disallow: [...PUBLIC_NOINDEX_DISALLOWS],
      },
    ],
    sitemap: "https://sitesinc.co/sitemap.xml",
  };
}