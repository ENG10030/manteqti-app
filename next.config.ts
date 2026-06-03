import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Security headers (migrated from middleware.ts)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // External packages - don't bundle, resolve at runtime (with .catch fallback)
  serverExternalPackages: ["z-ai-web-dev-sdk"],
  // Turbopack alias: resolve SDK to stub when not installed
  experimental: {
    turbo: {
      resolveAlias: {
        "z-ai-web-dev-sdk": "./src/lib/ai-sdk-stub.ts",
      },
    },
  },
};

export default nextConfig;
