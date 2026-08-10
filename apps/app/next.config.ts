import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
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
const withAgent = withEve(nextConfig, { eveRoot: "../agent" });

/**
 * Sentry wraps outermost so it instruments the eve service routes too.
 *
 * Everything here is env-driven and skips itself when unset: no
 * SENTRY_AUTH_TOKEN means no source map upload and a build that still
 * succeeds, so a fork or a local `next build` doesn't need Sentry
 * credentials to work. The Vercel integration sets all three.
 */
export default withSentryConfig(withAgent, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Ad blockers eat requests to ingest.sentry.io, and this audience runs ad
  // blockers. Same-origin proxy so client errors actually arrive.
  tunnelRoute: "/monitoring",

  // Uploaded for readable stack traces, then deleted from the output so the
  // app doesn't serve its own sources.
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  // No `disableLogger` — it's deprecated, and its replacement
  // (webpack.treeshake.removeDebugLogging) does nothing under Turbopack,
  // which is what Next 16 builds with.
  silent: !process.env.CI,
});
