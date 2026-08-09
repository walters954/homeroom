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
- **Migrations apply themselves on production deploys only.** `apps/app/vercel.json`
  runs `migrate:deploy` when `VERCEL_ENV=production`, so a failed migration fails
  the build instead of shipping code against a schema that isn't there. Previews
  skip it deliberately — they share the production database, so a preview build
  would otherwise migrate production from an unmerged branch. Keep migrations
  **additive and backward-compatible** (add a nullable column, add a table): they
  land before the new code is serving, so the old code has to survive them.

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

**Components come from `@homeroom/ui`** (shadcn/ui in `packages/ui/src`):
`Button`, `Input`, `Textarea`, `Select`, `Label`, `Card` (+`CardHeader`,
`CardContent`, `CardFooter`, `CardRow`), `Badge`, `Table`, `Dialog`, `Sheet`,
`DropdownMenu`, `Separator`. Reach for one of these before writing markup.

The shadcn semantic tokens (`bg-card`, `text-muted-foreground`, `border-input`,
`bg-primary`, …) are **aliases over the Homeroom tokens above**, declared in
`globals.css`. Both names render identically, so use whichever reads better —
but never introduce a third palette.

The `hr-*` layer that remains is **typographic, not component**: `.hr-eyebrow`,
`.hr-title`, `.hr-sub`, `.hr-ev`, `.hr-path`, `.hr-cite`, `.hr-prose`,
`.hr-scroll-x`. shadcn has no equivalent for these and inlining them everywhere
would be worse, so they stay. `.hr-btn` / `.hr-row` / `.hr-tag` are a shrinking
tail — prefer `Button` / `CardRow` / `Badge` in new code.

Layout stays local: `<Page>`, `<PageHeader>`, `<EmptyState>` in
`apps/app/components/`.

**The agent pane is mounted once, in the shell** (`components/agent/provider.tsx`),
so a conversation survives moving between pages. Pages never render it — they
declare what it is looking at with `<AgentScope scope={{ kind: … }} />`, and all
of its copy is derived from the kind in `lib/agent/scope.ts`. A page that
declares nothing gets the `progress` scope; `/admin/*` gets no pane at all,
because there you are reviewing the agent rather than talking to it.

Its arrival state is a **brief** (`lib/agent/brief.ts`): what the agent already
knew before you got here. `/api/tutor/brief` streams two NDJSON lines — the
derived sentence, straight from rows, then the model's rewrite of it — so the
model is never on the critical path and an outage costs the nicer sentence, not
a true one. Briefs are cached per member per scope against a **state
fingerprint** (last submission, what's due, the thread's last reply), so a page
view only costs a model call when the state it describes has moved. **Evidence
lines are never model-authored.**

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

## Running exercise submissions

Three files, and the split between them is the point. `runner.ts` is the only entry
point. `harness.ts` holds every judgement — which languages can run (`planFor`), the
harness source, and what the output *means*. `sandbox.ts` is only transport: put the
files in a microVM, run the harness, bring stdout back.

Submissions run in a Vercel Sandbox with `networkPolicy: "deny-all"`, a fresh
filesystem per attempt and a wall-clock cap. Auth is the mechanism the app already
uses for model calls: on Vercel the deployment's OIDC token is picked up
automatically, so there is **no new secret to configure**. Off-Vercel it needs
`VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`, and with neither the runner
says so rather than guessing.

Two rules that are not negotiable:

- **Pass/fail comes from a real process exit and real assertions, never from a model.**
  A pass sets a PROVEN skill state, seeds a recall schedule and unlocks the worked
  solution — a fabricated green corrupts all three.
- **Anything that prevents a run is a failure, not a pass**: unsupported language,
  missing sandbox credentials, no test files, a sandbox that won't boot.

An exercise carries hidden `testFiles` (`[{path, contents}]`, never sent to the
browser) alongside the learner-visible `testSpec`. A test file default-exports
`[{ name, run }]` and `run` throws to fail, which makes `node:assert` the whole
assertion library and keeps authored tests free of any dependency we would have to
install per run. Names must match `testSpec` — a spec row nothing reported on counts
as failed. JS and TS share one runtime (Node 24 strips types natively).

Everything else — Apex above all — has no runtime outside its own platform, so
`planFor` returns null and it reports honestly. Admins keep a manual override that
records itself as an override.

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

The tutor's corpus is scope-aware (`lib/tutor/grounding.ts`), and on an exercise
it is given the brief, the starter files, the check *names*, and the learner's
own submission and failures — **never `testFiles` or `solutionFiles`**. A tutor
holding the answer key would recite the assertion you are failing, which is the
hint ladder collapsing into a solution. `lib/tutor/context.test.mjs` guards that
too; assembly stays in `lib/tutor/context.ts`, which has no database import so
the guarantee stays testable.

All admin surfaces are on the Console direction and every screen has a
small-screen state, so the app is usable on a phone.

Creators can author exercises in the app (`/admin/exercises/[id]`, reached from
a course's skills section) and import a member list from CSV
(`/admin/members/import`). Before publishing an exercise, **run the reference
solution against its own tests** — if the author's answer cannot pass, a
learner would be told correct code is wrong.

Curriculum order is editable (`moveSection` / `moveLesson` in
`lib/actions/courses.ts`, and a section picker on the lesson form). Reordering
rewrites the whole sibling list as 0..n-1 rather than swapping two rows —
seeded content already has duplicate and gapped `order` values, and a two-row
swap silently does nothing when both hold the same number.

Admins can **view as student** (`lib/viewer.ts`, `components/preview-bar.tsx`):
while previewing, `getCurrentUser()` reports MEMBER, so paywalls and draft
lessons apply and `/admin` redirects away until you step back out. Only
`getActualUser()` sees through it.

Not built yet: Apex execution (#29 — so Apex exercises still report honestly and
admins use the manual override), the repo-grounded tutor (#8), and per-user dark
mode (#40 — the surface is school-wide today). **Stripe is still in sandbox
(#1)** — the one thing blocking real money, needing the live account imported
via the Vercel integration.
