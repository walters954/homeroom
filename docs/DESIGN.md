# Homeroom — Design System

The reference implementation is the **Console** direction. Every screen we build follows
this document; when something here conflicts with a mockup, this document wins.

Live reference: the Console mockup covers Today, Watch, Attempt, Solution, Events,
Recall, Capability, and Coach, plus live brand theming.

---

## 1. What the design is for

Homeroom is a **practice operating system** for technical courses, not a video library.
The interface exists to run one loop:

> **attempt something real → immediate specific feedback → visible progress → return at the right time**

Three consequences that override normal LMS instincts:

- **Video teaches; the attempt proves it.** Video is first-class — it's how the
  instructor actually explains things and it grounds the tutor — but progress is
  measured by passing an exercise, never by watching or clicking "complete."
- **One next action beats a catalog.** A returning learner sees a single task and
  the reason it was chosen. Browsing is a fallback, not the front door.
- **The agent is a pane, not a bubble.** The tutor is docked beside the work and
  rescopes to what's on screen (this lesson / this attempt / your progress).

The audience writes code all day in Linear-, Vercel-, and GitHub-shaped tools. The
interface should feel native to them: dense, keyboard-forward, quiet.

---

## 1b. Agent-first, as a design test

Agent-first is not a chat bubble on top of a normal app. It is a question asked of
**every** screen before it is designed:

> **What did the agent already do before the person got here — and how do they check it?**

If the answer is "nothing, the screen waits for input," the screen is not agent-first
and should be redesigned. A blank form, an empty search box, or a catalog to browse
are all signs the human is being asked to do work the agent could have done.

Three properties follow, and every screen must have all three:

1. **Arrival state is a decision, not a blank.** The agent has already chosen,
   drafted, assembled, or ranked something. The person arrives to a proposal.
2. **The reason is visible.** The screen says why — *"you failed ordering guarantees
   twice last week"* — because an unexplained decision reads as arbitrary and gets
   ignored. Reasons come from observed evidence, never from vibes.
3. **There is a seam to disagree.** Approve, edit, dismiss, skip, or ask. The agent
   proposes; the human disposes. Anything member-visible that the agent isn't certain
   of waits in a queue.

### Worked examples

| Screen | The non-agentic version | The agentic version |
|---|---|---|
| **Today** | A course catalog and a progress bar. The learner decides what to do. | The agent picked one task from what's proven and what's decaying, states the reason, and offers "skip to the attempt" as the disagreement seam. |
| **Watch** | A video player with a lesson list. | The transcript is already indexed and searchable; the agent knows which passage the next exercise tests and raises the watch→attempt handoff exactly there; questions get answered from this lesson with a timecode. |
| **Attempt** | An editor and a Run button. | The agent has already read the file and run the tests; it explains the specific failure against *your* line, and deliberately withholds the answer to protect the struggle. |
| **Events** | A calendar the creator fills in. | The agent proposes the topic from the lowest first-attempt pass rate, drafts an agenda around the clustered error, names the three members who are failing silently, and turns the recording into an indexed lesson. |
| **Capability** | A completion percentage. | The agent maintains an assessment — proven / shaky / untested — from attempt evidence, and names the error patterns it has observed repeating. |
| **Coach** | Completion-rate dashboards. | The agent distinguishes an unclear exercise from a productively hard one, drafts the fix with its observations attached, and flags who is stuck without asking. |
| **Content admin** | Empty lesson form with a markdown box. | The transcript is already drafted into a lesson body with SEO, waiting in the review queue with the excerpt it was written from. |

### Anti-patterns

- An "Ask AI" button that opens an empty chat. That's a feature, not an operating model.
- The agent as an optional toggle. If the screen works identically with the agent off,
  it isn't agent-first.
- Agent output with no evidence line — indistinguishable from a guess.
- Auto-publishing anything member-visible without an approval seam.
- Asking the person to configure what the agent could infer.

### The counterweight

Agent-first does **not** mean the agent does the learning. It does the operating work
— choosing, drafting, indexing, watching, scheduling — so the human can do the
thinking. On learner surfaces the agent's job is often to *withhold*: the hint ladder
exists so the tutor can help without solving, and revealing the answer costs the
proven mark. An agent that removes productive struggle has broken the product it's
built into.


---

## 2. Color

### Structure

Neutrals, semantics, and the brand accent are three separate systems. **A school
re-themes the accent only** — that's why a re-theme can never break contrast or
change what a color means.

```css
/* Neutrals — Homeroom's, never overridden */
--bg:    #FBFBFC;   /* app ground */
--panel: #FFFFFF;   /* cards, rails, surfaces */
--line:  #E4E6EA;   /* borders */
--soft:  #EFF1F3;   /* dividers inside a surface, inert fills */
--ink:   #14161A;   /* primary text */
--dim:   #6B7280;   /* secondary text, labels */

/* Semantics — meaning, not brand. Never re-themed. */
--fail:      #B3261E;  --fail-soft: #FDECEA;   /* failing test, error pattern */
--warn:      #B45309;  --warn-soft: #FEF3E2;   /* shaky skill, due for recall */

/* Brand accent — the only tokens a school overrides */
--acc:      #0F766E;   /* primary actions, active nav, progress fill */
--acc-soft: #E6F2F0;   /* accent backgrounds, proven tags */
--acc-ink:  #FFFFFF;   /* text on --acc */
--acc-deep: #0B564F;   /* hover/pressed on --acc */
```

### Rules

1. **Semantic color is not decoration.** `--fail` means a test failed or a pattern is
   costing attempts. `--warn` means shaky or due. Never use them to add visual interest.
2. **Proven state uses the accent, not green.** "Proven" is the product's success
   state and should carry the school's brand.
3. **Accent overrides must ship all four tokens.** A brand hex alone is not enough —
   `--acc-soft` needs to stay legible under `--acc` text, and `--acc-ink` must pass
   contrast on `--acc`. Validate at 4.5:1 for text, 3:1 for UI edges.
4. **Never put brand color on neutrals.** Backgrounds, borders, and body text stay
   Homeroom's. A brand-tinted page ground is how themed apps start looking broken.

### Where brand color is allowed to appear

Primary buttons · active nav item · progress and scrub fills · "proven" tags ·
the accent border on a tutor citation · the watch→attempt handoff band · focus rings.

Nowhere else.

---

## 3. Typography

No webfonts. The Artifact/CSP environment blocks font CDNs and a silent fallback is
worse than a considered system stack.

```css
--font-ui:   ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title | 21px | 700 | `letter-spacing: -.022em`, `text-wrap: balance` |
| Section title | 16–19px | 650 | |
| Body | 13–13.5px | 400 | `line-height: 1.6` |
| Secondary | 12.5px | 400 | `--dim` |
| Meta / evidence | 11–11.5px | 400 | `--dim` |
| Eyebrow | 10px | 700 | `letter-spacing: .13em`, uppercase |
| Code, timecodes, paths, IDs | 12.5px | 400 | `--font-mono` |

Mono is **semantic**, not stylistic: use it for anything the machine owns — code,
file paths, timecodes, durations, run times, IDs. Never for prose.

Any column of digits gets `font-variant-numeric: tabular-nums`.

---

## 4. Layout

**Three panes.** A 52px icon rail, a fluid content column, and a 340px agent panel.
The agent panel hides on creator screens (Coach) where you're reviewing the agent
rather than talking to it; the grid collapses to two columns.

```
┌────┬──────────────────────────┬───────────────┐
│rail│ command bar              │ tutor         │
│52px│──────────────────────────│ 340px         │
│    │ content (max ~66ch prose)│ (contextual)  │
└────┴──────────────────────────┴───────────────┘
```

- Content padding `20px 24px`; card padding `14px`; card header/footer `11px 14px`.
- Gap between sibling blocks: `12px` inside a group, `16–22px` between groups.
- Radius: `7px` controls, `9–11px` surfaces. Nothing fully rounded except avatars.
- Prose caps at ~66ch. Tables and code get `overflow-x: auto` on their own container.
- Below 940px everything stacks to one column.

---

## 5. Components

**Card** — `--panel` on `--line`, optional header and footer. The footer is `--bg`
and holds actions. This is the default container; reach for it before inventing.

**Row** — a flex line inside a card, `10px 13px`, divided by `--soft`. Rows carry a
label, an evidence line in `--dim`, and a trailing state chip or metric.

**Tag** — 10px, 700, uppercase-ish. Four only: `proven` (accent), `shaky` (warn),
`untested` (soft), `fail` (fail). If you need a fifth, question the state model.

**Evidence line** — every claim the product makes about a person shows its evidence
beneath it in `--dim` at 11px: *"proven 3× · no hints used · 6 days ago"*. This is
the single most important convention in the system. Nothing asserts without it.

**Citation** — accent left border, `--bg` fill, source in bold plus a mono locator.
Used wherever the agent says something grounded: `Your line 7 · lesson 19:05`.

**Agent draft** — a card with a `fail`/`warn` tag, the draft body, an observations
block in `--bg`, and a footer with Approve / Edit / Dismiss. Never publishes directly.

**Editor** — file tabs, gutter, code, action bar, then test rows. The failing line
gets `--fail-soft`. Test rows use a 15px square mark, not an emoji.

**Hint ladder** — rows numbered in mono; locked rows sit on `--bg` in `--dim` and
state the cost: *revealing this drops the "proven" mark*.

---

## 6. Voice

Write from the learner's side of the screen.

- Name things by what a person recognizes: *attempt*, *proven*, *due for recall* —
  not *submission*, *entitlement*, *SRS interval*.
- Always give the reason: *"chosen because you failed ordering guarantees twice."*
  A next-best action without a why reads as arbitrary.
- The tutor refuses to do the work: *"I'm not going to write it for you — you're one
  clause away."* Helpfulness that removes the struggle removes the learning.
- State cost plainly: *"revealing this drops the proven mark."*
- No congratulation inflation. "All four tests pass" beats "Great job!"
- Never say percent complete. Say what someone can do.

---

## 7. Theming a school

An admin sets brand in `/admin/settings`. The implementation contract:

1. Store `accent`, `accentSoft`, `accentInk`, `accentDeep` in the `branding` setting.
2. Emit them as CSS custom properties on the app root — never inline per component.
3. Validate contrast on save and refuse a combination that fails; offer a corrected
   `accentSoft`/`accentInk` rather than shipping an unreadable UI.
4. Everything else — neutrals, semantics, type, spacing — is not configurable.

Deliberate: schools get identity, not a theme engine. A creator cannot make Homeroom
look broken, and every Homeroom instance stays recognizably the same product.

---

## 8. Accessibility

- Visible focus on everything interactive: `2px solid var(--acc)`, `2px` offset.
- Never encode state in color alone — tags carry words, tests carry ✓/✕ marks.
- Respect `prefers-reduced-motion`.
- Semantic HTML: real `<button>`, real `<table>` for tabular data, `aria-current`
  on active nav.

---

## 9. Non-goals

Dark mode is not a launch requirement (add it token-level when it comes — the
structure already supports it). No gradients, no glassmorphism, no illustration
system, no emoji as UI. No leaderboards or XP: the research is clear that they drive
return behavior without producing competence, and Homeroom measures competence.
