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

  AI_GATEWAY_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  TUTOR_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
