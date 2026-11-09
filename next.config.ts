import type { NextConfig } from "next";
import path from "path";
import { isStagingEnv } from "./lib/site-env";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    const release = {
      source: "/release.json",
      headers: [
        { key: "Cache-Control", value: "public, max-age=60, must-revalidate" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    };
    if (process.env.NEXT_PUBLIC_FACTORY_PREVIEW !== "1" && !isStagingEnv()) return [release];
    return [
      release,
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
