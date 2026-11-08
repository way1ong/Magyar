import type { NextConfig } from "next";

/**
 * Two builds from one codebase:
 *  - default: the Node server (`next start`) on the laptop, with /api/backup;
 *  - MAGYAR_STATIC=1: a static export for GitHub Pages at /Magyar
 *    (scripts/build-static.mjs sets this and moves the API route aside).
 */
const isStatic = process.env.MAGYAR_STATIC === "1";
const basePath = isStatic ? "/Magyar" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isStatic
    ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } }
    : {
        // Service worker must be served from the root with no caching surprises.
        async headers() {
          return [
            {
              source: "/sw.js",
              headers: [
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                { key: "Service-Worker-Allowed", value: "/" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
