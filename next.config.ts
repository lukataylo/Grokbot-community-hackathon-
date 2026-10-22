import type { NextConfig } from "next";

const isStatic = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

const nextConfig: NextConfig = isStatic
  ? { output: "export", basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined, trailingSlash: true }
  : {};

export default nextConfig;
