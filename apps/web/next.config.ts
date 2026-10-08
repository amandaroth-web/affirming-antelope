import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@antelope/core"],
  turbopack: {
    // Monorepo root (apps/web -> ../..), so workspace packages resolve.
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
