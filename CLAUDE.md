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
pnpm turbo run test --filter=@homeroom/app       # exercise runner checks, Node 24
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
`.hr-sub`, `.hr-ev`, `.hr-path`, `.hr-prose`, `.hr-scroll-x`. Plus `<Page>`,
`<PageHeader>`, `<EmptyState>` in `apps/app/components/`.

**Every screen has to work at 375px.** The rail is a sidebar only from `lg`;
below that it is a top bar plus a drawer. Use `<Page>` rather than a hand-rolled
`<main>` so padding scales, put wide content in `.hr-scroll-x` or give tables a
`min-w-*` so they scroll inside themselves, and give any multi-column grid a
`sm:`/`md:` prefix — an unprefixed `grid-cols-2` is a bug on a phone.

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
with entitlements, community, events, member management, the agent suggestion
queue with a nightly drafting schedule, and the practice-loop screens (Today /
attempt / recall / capability / coach).

Exercises execute for real: `lib/exercises/runner.ts` dispatches on
`Exercise.language`, and JS/TS submissions run against the exercise's hidden
`testFiles` in a Vercel Sandbox with `deny-all` egress. **Every path that is not
a genuine green is a failure, including our own outages** — a fabricated pass
would set a PROVEN state, seed a recall schedule and unlock the worked solution
off nothing. `lib/exercises/harness.test.mjs` guards that; keep it passing.

All admin surfaces are on the Console direction and every screen has a
small-screen state, so the app is usable on a phone.

Not built yet: Apex execution (#29 — so the two Apex exercises still report
honestly and admins use the manual override), exercise authoring outside the
seed script (#30), bulk member import for the Circle migration (#36), and the
repo-grounded tutor (#8). **Stripe is still in sandbox (#1)** — that is the one
thing blocking real money, and it needs the live account imported via the Vercel
integration.
