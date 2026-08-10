import * as Sentry from "@sentry/nextjs";

/**
 * Server runtime. Loaded from `instrumentation.ts` when NEXT_RUNTIME is nodejs.
 *
 * Without SENTRY_DSN every call becomes a no-op, which is the same contract
 * every other integration here follows (`lib/notify.ts`): missing key → does
 * nothing, never a crash. So a fork of Homeroom that doesn't want error
 * tracking gets it by not setting the variable.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Errors are the point. Tracing is sampled thin — it shares the free plan's
  // quota and we are not chasing latency yet.
  tracesSampleRate: 0.05,

  // Deployed only. A local dev server throwing while someone is mid-edit is
  // not news, and the free plan drops events silently once its monthly quota
  // is gone — so the quota is spent on production and previews. Previews stay
  // in because they share the production database, and `environment` above
  // keeps them from being mistaken for the real thing.
  enabled: Boolean(process.env.VERCEL_ENV),
});
