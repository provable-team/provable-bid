import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server be used from both hostnames (PayPal popups can return to either).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
