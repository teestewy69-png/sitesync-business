import type { NextConfig } from "next";
import path from "path";
import { isStagingEnv } from "./lib/site-env";

const nextConfig: NextConfig = {
  // Next 16 blocks /_next from 127.0.0.1 when the dev server bound to localhost.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    if (process.env.NEXT_PUBLIC_FACTORY_PREVIEW !== "1" && !isStagingEnv()) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
