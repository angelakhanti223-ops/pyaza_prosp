import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained production build (only the node_modules actually needed at
  // runtime get copied) — see frontend/Dockerfile.prod.
  output: "standalone",
  async rewrites() {
    return [
      { source: "/candidates", destination: "/candidate-form.html" },
      { source: "/tours/china-constructor", destination: "/china-tour-builder.html" },
    ];
  },
  async headers() {
    return [{ source: "/crm-task-sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }, ...["/candidates", "/candidate-form.html"].map(source => ({
      source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }],
    }))];
  },
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
