import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Allow large file uploads through middleware (50MB)
    middlewareClientMaxBodySize: '50mb',
  },
  serverExternalPackages: ['openai'],
};

export default nextConfig;
