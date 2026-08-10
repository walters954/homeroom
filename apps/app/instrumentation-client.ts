import * as Sentry from "@sentry/nextjs";

/**
 * Browser runtime. No session replay and no user feedback widget — the free
 * plan's error quota is what we came for, and both of those spend it on
 * things we haven't asked a question about yet.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  enabled: Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
