import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@vladmandic/human", "@tensorflow/tfjs-node", "sharp", "web-push", "postgres"],
  outputFileTracingIncludes: { "/**": ["./models/**/*", "./db/**/*"] },
  poweredByHeader: false,
  async redirects() {
    return ["/v1", "/v2", "/v3"].map((source) => ({ source, destination: "/", permanent: true }));
  },
  async rewrites() {
    return [{ source: "/", destination: "/landing-v1.html" }, { source: "/privacy", destination: "/privacy.html" }];
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(self), geolocation=()" }] },
    ];
  },
};

export default nextConfig;
