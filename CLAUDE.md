# Homeroom — working notes for agents

Open-source, **agent-first course + community platform for technical courses**
(Salesforce development, GTM engineering, AI tooling). First production school is
Revenue Engineer, migrating off Circle. AGPL-3.0.

Read before making product or UI decisions:

- **`docs/PLAN.md`** — what Homeroom is, the practice-loop model, decisions and why.
- **`docs/DESIGN.md`** — the design system. Binding, not advisory.

---

## The two rules that decide most arguments

**1. The practice loop is the product.**
`attempt something real → immediate specific feedback → visible progress → return at the right time`

Video teaches; the attempt proves it. Progress advances when someone passes an
exercise they hadn't seen — never by watching or clicking "mark complete."

**2. Agent-first is a test, not a chat bubble.** Before designing any screen:

> What did the agent already do before the person got here — and how do they check it?

If the answer is "nothing, the screen waits for input," redesign it. Every screen
needs an arrival state that is a decision, a visible reason, and a seam to disagree
(approve / edit / dismiss / skip / ask). Nothing member-visible that the agent isn't
certain of ships without an approval queue.

Corollary for learner surfaces: the agent's job is often to **withhold**. The hint
ladder lets the tutor help without solving, and revealing the answer costs the
"proven" mark. An agent that removes productive struggle has broken the product.

---

## Architecture

Turborepo + pnpm. One Vercel project (`homeroom` in the `dark-nimbus` team),
serving https://learn.revenueeng.com.

```
apps/app/       Next.js 16 app — and the eve agent mounted same-origin via withEve
apps/agent/     eve agent definition: instructions, tools, skills, schedules
packages/db/    Prisma schema + migrations (Neon Postgres)
packages/auth/  Better Auth (email+password, magic link, reset, verification)
packages/ui/    shared components
packages/env/   env validation
```

- **The eve agent is not a second deployment.** `withEve()` in
  `apps/app/next.config.ts` emits Build Output service routes so `/eve/v1/*` is
  served same-origin. Callers authenticate with the app's own session
  (`apps/agent/agent/channels/eve.ts`).
- **Model calls go through Vercel AI Gateway** using the deployment's OIDC token —
  there is no API key to manage. Per-task model choice lives in `/admin/settings`
  (`lib/ai.ts` → `modelFor("simple" | "complex")`).
- **Single-tenant by design.** One deployment = one school. No `organizationId`.

## Commands

```bash
pnpm install
pnpm turbo run build --filter=@homeroom/app     # app build
pnpm turbo run build --filter=@homeroom/agent   # needs Node 24
pnpm typecheck
pnpm db:migrate                                  # prisma migrate dev
```

- **`apps/agent` requires Node 24** (`export PATH="/opt/homebrew/opt/node@24/bin:$PATH"`,
  or `nvm use` — see `.nvmrc`). The Next.js app does not.
- **Never run `pnpm dev` / `npm run dev`.** Assume a server is already running, or
  ask. To see the app, drive the live deployment instead.
- Deploy with `vercel deploy --prod --yes` from the repo root — only when asked.

## Styling — non-negotiable

Use the token classes from `apps/app/app/globals.css`. **Never** write a hardcoded
colour class (`zinc-*`, `gray-*`, `green-*`, `blue-*`, `amber-*`, `red-*`) — a
school re-themes the app and hardcoded colours are how dark mode half-applies.

```
surfaces  bg-bg  bg-panel  bg-soft
text      text-ink  text-dim
lines     border-line  border-soft
accent    bg-acc  text-acc  text-acc-ink  bg-acc-soft
semantic  text-fail bg-fail-soft · text-warn bg-warn-soft
```

Components: `.hr-card`, `.hr-card-h/b/f`, `.hr-row`, `.hr-btn` (+`.hr-btn-primary`,
`.hr-btn-sm`), `.hr-input`, `.hr-tag-*`, `.hr-cite`, `.hr-eyebrow`, `.hr-title`,
`.hr-sub`, `.hr-ev`, `.hr-path`, `.hr-prose`. Plus `<Page>`, `<PageHeader>`,
`<EmptyState>` in `apps/app/components/`.

**Every claim about a person shows its evidence** beneath it in `--dim` at 11px:
*"proven 3× · no hints used · 6 days ago"*. Nothing asserts without it.

**Empty states are decision points**, never a bare "No courses yet." Say what's
missing and give the action that fixes it.

## Conventions

- Server components by default; `"use client"` only for real interactivity.
- Mutations are server actions in `apps/app/lib/actions/*.ts`, guarded by
  `requireUser()` / `requireAdmin()` from `lib/session.ts`.
- A `"use server"` file may only export async functions — put sync helpers elsewhere
  (see `lib/comp.ts`).
- Integrations degrade silently when unconfigured (`lib/notify.ts`): missing key →
  no-op, never a crash.
- Long-running model work needs `export const maxDuration` on the page or route that
  hosts the action.

## Tracking

Work lives in **GitHub Issues** on `walters954/homeroom`, on project board #3.
Labels: area (`learner` / `creator` / `agent` / `platform` / `design`) and track
(`launch` = blocks cancelling Circle, `technical-courses` = the niche, `later`).
File an issue rather than leaving a TODO in code.

## Current state

Deployed and working: auth with reset/verification/magic-link invites, courses and
lessons with Vimeo transcripts, the tutor grounded in transcripts, Stripe checkout
with entitlements, community, events, member management, and the agent suggestion
queue with a nightly drafting schedule.

Not built yet: the practice-loop screens (Today / attempt / recall / capability /
coach), code execution for exercises, and the repo-grounded tutor. Stripe is still
in sandbox.
