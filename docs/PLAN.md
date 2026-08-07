# Homeroom — Design & Plan

This document is the shared understanding the project started from (August 2026). It is the output of a structured design interview; decisions here were made deliberately, not by default.

## Thesis

Homeroom is an open-source, agent-first course + community platform — the Kajabi/Teachable/Circle alternative where an AI agent is the operating model, not a feature. Borrowing trycompai/crm's founding inversion: **the LMS is where the teaching agent keeps its notes.** The agent ingests every video transcript and lesson, tutors students in context, drafts content and announcements for the creator's approval, tracks progress, and participates in the community. The creator supervises queues instead of doing platform admin.

Market context (researched Aug 2026): no open-source project bundles courses + community at production maturity (CourseLit and LearnHouse are beta/alpha); nothing open or closed is agent-first — Circle's AI Agents are a paid answer-bot upsell. All three incumbents had 2025–26 pricing shocks that broke creator trust.

**First proof: Revenue Engineer migrates off Circle onto Homeroom. v1 is done when Circle is canceled.**

## Product decisions

- **Headless-first:** Homeroom owns the logged-in experience (courses, lessons, community, events, accounts, billing settings). Marketing/landing pages stay on the creator's own site. Homeroom serves public, SEO-indexed course catalog, lesson-preview, shareable post, and event pages.
- **Community v1:** spaces → posts (rich text, images, links, embeds) → comments + reactions + member profiles. Shareable public URLs per post. No DMs, no realtime chat, no gamification. The agent can post/reply in threads.
- **Curriculum:** Course → Section → Lesson (video + rich text + attachments + transcript). Progress tracking; no drip/cohorts. AI quizzes later as a content-ops output.
- **Events:** native — rich description, RSVP, ICS, reminder email, join link, shareable public page. No livestream hosting.
- **Payments:** Stripe subscriptions with trials. Products → course entitlements even with one product. No invoicing.
- **Email:** transactional + agent-drafted sends via Resend. Kit remains the marketing channel (tag/webhook sync). Homeroom never grows a broadcast suite.
- **Integrations v1:** Slack outbound webhooks (new lesson / post / event → channel notification with deep link). Discord and two-way sync later.

## Agent design

Four jobs, all grounded in the transcript + lesson corpus, with evidence discipline — strong evidence acts, weak evidence suggests, the agent never asserts beyond the corpus:

1. **Tutor** (student-facing) — bottom-right floater with current-page context (lesson → transcript + that student's progress). Answers cite lessons and timestamps. Standalone "Ask" page follows.
2. **Content ops** (creator-facing) — video → transcript → drafted lesson text, SEO metadata, later quizzes, into a review queue.
3. **Engagement (slim v1)** — new-content announcements and pace-tracking emails, drafted into an approval queue.
4. **Community presence** — replies in threads or suggests replies; escalates when unsure.

## Architecture

- **Monorepo:** Turborepo + pnpm on Node — `apps/app` (Next.js), `apps/api` (NestJS), `apps/agent` (eve), `packages/db` (Prisma → Neon), `packages/auth` (Better Auth), `packages/ui`, `packages/env`.
- **Single-tenant:** one deployment = one school. Creator owns their Neon DB and Stripe account. Future business = managed single-tenant hosting (the Ghost model); creators can export and leave anytime.
- **Video:** `VideoSource` abstraction — Vimeo, YouTube, Mux per lesson. Revenue Engineer starts on Vimeo; Mux is a config change. Transcript pipeline is host-independent: pull captions if available, else Whisper on the raw file; stored on the lesson, indexed for the agent.
- **License:** AGPL-3.0. Fallback names considered: Commonplace, Primer.

## Migration plan (Circle → Homeroom)

1. Export member list + subscription state from Circle; map to Stripe.
2. Upload Google Drive raw videos to Vimeo; Whisper the raws for transcripts.
3. Rebuild curriculum (partly agent-drafted from transcripts).
4. Recreate active community spaces; seed upcoming events; Slack webhook on.
5. Parallel-run, invite members, cancel Circle.

## Build order

1. **Skeleton** — monorepo, auth, schema, deployed shell ✅
2. **Courses + video + transcripts** — Vimeo VideoSource, lesson pages, progress, transcript ingest ✅
3. **Agent core** — tutor floater grounded on the transcript corpus (streaming, via Vercel AI Gateway) ✅
4. **Checkout** — Stripe subscriptions + trials, entitlement gating, subscribe CTAs ✅
5. **Community + events** — spaces/posts/reactions, public share pages, events + RSVPs + ICS + reminder cron, Resend, Slack webhooks, Kit sync ✅
6. **Content-ops + engagement queues** — lesson drafts + announcements from transcripts, nudge suggestions, approval queue ✅

**Next:** migrate Revenue Engineer (Vimeo uploads from Drive raws, transcripts, curriculum rebuild, members), deploy to Vercel, cancel Circle. Later: eve-based durable agent ops, Whisper fallback for caption-less video, pgvector retrieval, Discord + two-way Slack sync, AI quizzes.
