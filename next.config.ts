import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // El servidor se empaqueta dentro de la app de escritorio (Tauri).
  output: "standalone",
  experimental: {
    optimizePackageImports: ["effect"],
  },
};

export default nextConfig;
