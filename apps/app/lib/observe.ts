import * as Sentry from "@sentry/nextjs";

/**
 * Report a failure that the surrounding code deliberately swallows.
 *
 * Degrading gracefully for the member and telling us nothing were the same
 * line of code until now: every `catch {}` in `lib/notify.ts` and the tutor
 * routes kept the page working and left us blind. That is why every model
 * call in production could 500 for days and the first sign of it was someone
 * noticing by hand. Call this inside the catch — the member-facing fallback
 * stays exactly as it is.
 *
 * Never throws. Reporting a failure must not become one.
 */
export function report(where: string, error: unknown, extra?: Record<string, unknown>): void {
  try {
    Sentry.captureException(error, { tags: { where }, extra });
  } catch {
    // Sentry unconfigured or unreachable. There is nothing above us to tell.
  }
}
