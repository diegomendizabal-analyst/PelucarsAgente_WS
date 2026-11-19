import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
