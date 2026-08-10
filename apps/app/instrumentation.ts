import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Next's hook for errors thrown out of server components, server actions and
 * route handlers. This is the half that matters here: mutations in
 * `lib/actions/*` are server actions, and a throw in one of those was
 * previously visible only as a red toast in one person's browser.
 */
export const onRequestError = Sentry.captureRequestError;
