# Homeroom

**Open-source, agent-first course + community platform.** The Kajabi / Teachable / Circle alternative where an AI agent is the operating model, not a feature — *the LMS is where the teaching agent keeps its notes.*

The agent ingests every video transcript and lesson, tutors students in context (with citations), drafts content and announcements for the creator's approval, tracks member progress, and participates in the community. The creator supervises queues instead of doing platform admin.

## What Homeroom is

- **Headless-first** — Homeroom owns the logged-in experience: courses, lessons, community, events, accounts, billing. Your marketing site stays yours; Homeroom serves public, SEO-indexed catalog, lesson-preview, post, and event pages.
- **Courses** — Course → Section → Lesson, with video (Vimeo / YouTube / Mux per lesson), rich text, attachments, and first-class transcripts that feed the agent.
- **Community** — spaces, posts, comments, reactions, member profiles. No DMs, no gamification. The agent can join threads.
- **Events** — rich event pages, RSVPs, calendar files, reminder emails. Your webinar runs wherever it runs.
- **Payments** — Stripe subscriptions with trials; products map to course entitlements.
- **Email** — transactional only (Resend). Your marketing list stays in your email tool (Kit sync built in).
- **Single-tenant** — one deployment, one school. You own your database and your Stripe account. No `organizationId` anywhere.

## Stack

Turborepo + pnpm · Next.js (App Router) · Prisma + Neon Postgres · Better Auth · [eve](https://github.com/vercel/eve) (durable agent runtime) · Tailwind 4

```
apps/app/       Next.js app + mounted eve agent (port 3000)
apps/agent/     eve agent definition (tools, skills, schedules)
packages/db/    Prisma schema & client
packages/auth/  Better Auth configuration
packages/ui/    Shared UI components
packages/env/   Environment validation
```

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL (Neon) + BETTER_AUTH_SECRET
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The `apps/agent` eve runtime requires **Node 24** (`nvm use`, see `.nvmrc`); the
Next.js app runs on Node 22+. Build them separately if your default is older:

```bash
pnpm turbo run build --filter=@homeroom/app     # any recent Node
pnpm turbo run build --filter=@homeroom/agent   # Node 24
```

## Status

Early scaffold. Built in the open; first production school is [Revenue Engineer](https://www.cloudcodeacademy.com/) migrating off Circle. See [docs/PLAN.md](docs/PLAN.md) for the full design.

## License

[AGPL-3.0](LICENSE)
