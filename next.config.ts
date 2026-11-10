import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // El contenido vive en disco: nada que optimizar en build.
    optimizePackageImports: ["effect"],
  },
};

export default nextConfig;
