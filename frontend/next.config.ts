import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/sigma",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
