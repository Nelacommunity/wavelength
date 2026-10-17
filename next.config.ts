import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Avatars are capped at 2 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "2.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // The worker caches cover art from Supabase/CDNs, so it must be able to fetch https: images.
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self' https:; img-src 'self' https: data:" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
