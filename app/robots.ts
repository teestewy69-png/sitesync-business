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
      {
        // AI training / learning crawlers — blocked site-wide (Tony, 2026-11-25).
        // AI answer/search bots (OAI-SearchBot, PerplexityBot, Claude-SearchBot,
        // Googlebot, Bingbot) are intentionally NOT listed: they follow the
        // general rule above so the site can still be cited in AI answers.
        userAgent: [
          "GPTBot",
          "Google-Extended",
          "CCBot",
          "anthropic-ai",
          "ClaudeBot",
          "Meta-ExternalAgent",
          "Bytespider",
          "Applebot-Extended",
          "cohere-ai",
          "AI2Bot",
          "Diffbot",
          "ImagesiftBot",
          "Omgilibot",
        ],
        disallow: "/",
      },
    ],
    sitemap: "https://sitesinc.co/sitemap.xml",
  };
}