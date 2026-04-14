import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  serverExternalPackages: ["z-ai-web-dev-sdk"],
};

export default nextConfig;
