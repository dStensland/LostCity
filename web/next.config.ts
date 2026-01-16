import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Rewrite / to /atlanta internally (no redirect, keeps URL as /)
        source: "/",
        destination: "/atlanta",
      },
    ];
  },
};

export default nextConfig;
