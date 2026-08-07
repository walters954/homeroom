import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@homeroom/auth",
    "@homeroom/db",
    "@homeroom/env",
    "@homeroom/ui",
  ],
};

export default nextConfig;
