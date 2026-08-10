import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(1).default("insecure-dev-secret"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  VIMEO_ACCESS_TOKEN: z.string().optional(),
  KIT_API_KEY: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // Bring-your-own Salesforce org (#29). An External Client App, since
  // connected app creation is restricted from Spring '26.
  SALESFORCE_CLIENT_ID: z.string().optional(),
  SALESFORCE_CLIENT_SECRET: z.string().optional(),
  // Encrypts the stored refresh token. 32+ chars: openssl rand -base64 32
  SALESFORCE_TOKEN_KEY: z.string().min(16).optional(),

  // Error tracking (#52). Unset means the SDK no-ops, same as every other
  // integration here. SENTRY_ORG/PROJECT/AUTH_TOKEN are build-time only and
  // are set by the Vercel integration; without them the build skips source
  // map upload rather than failing.
  // Any Sentry-protocol host: sentry.io, or a self-hosted GlitchTip/Bugsink.
  // Switching is this variable and nothing else.
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Cron liveness. Any healthchecks.io-protocol ping URL — the hosted free
  // tier, a self-hosted instance, or Better Stack heartbeats.
  HEARTBEAT_ENGAGEMENT_URL: z.string().url().optional(),
  HEARTBEAT_EVENT_REMINDERS_URL: z.string().url().optional(),

  AI_GATEWAY_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  TUTOR_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
