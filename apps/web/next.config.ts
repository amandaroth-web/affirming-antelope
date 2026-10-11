import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@antelope/core"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    // Monorepo root (apps/web -> ../..), so workspace packages resolve.
    root: path.join(__dirname, "../.."),
  },
  // PostHog first-party proxy (docs/tracking-plan.md). PostHog's API paths end in a
  // trailing slash, so don't let Next redirect them away.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  async redirects() {
    // Fallback for the www -> apex redirect, which is also set on the Vercel domain.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.affirmingantelope.com" }],
        destination: "https://affirmingantelope.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
