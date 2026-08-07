import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Transcript uploads (.vtt/.srt) travel through server actions and can
    // exceed the 1 MB default on long videos.
    serverActions: { bodySizeLimit: "10mb" },
  },
  transpilePackages: [
    "@homeroom/auth",
    "@homeroom/db",
    "@homeroom/env",
    "@homeroom/ui",
  ],
};

export default nextConfig;
