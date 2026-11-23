import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers.ts";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "development")},
      {source: "/api/:path*", headers: [{key: "Cache-Control", value: "private, no-store"}]},
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
