import type { NextConfig } from "next";
import { withEve } from "eve/next";

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
    "@homeroom/exercise-runner",
    "@homeroom/runner-apex",
    "@homeroom/runner-sandbox",
    "@homeroom/ui",
  ],
};

// Mounts the eve agent (apps/agent) same-origin at /eve/v1/*: one Vercel
// project, one deploy, no cross-service auth.
export default withEve(nextConfig, { eveRoot: "../agent" });
