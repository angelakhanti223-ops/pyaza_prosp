import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained production build (only the node_modules actually needed at
  // runtime get copied) — see frontend/Dockerfile.prod.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
    ],
  },
};

export default nextConfig;
