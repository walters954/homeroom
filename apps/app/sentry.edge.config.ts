import * as Sentry from "@sentry/nextjs";

/** Edge runtime (middleware). Same contract as `sentry.server.config.ts`. */
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  enabled: Boolean(process.env.VERCEL_ENV),
});
