/**
 * The derived brief is what the pane shows before — and instead of — the
 * model's version, so it has to be true on its own. Run with Node 24:
 * `pnpm --filter @homeroom/app test`.
 */

import assert from "node:assert";
import test from "node:test";

import { derivedBrief } from "./brief-text.ts";

const NOW = new Date("2026-08-09T12:00:00Z");

test("an unattempted exercise says so rather than inventing progress", () => {
  const { text, evidence } = derivedBrief(
    {
      kind: "exercise",
      title: "Total a cart",
      totalChecks: 3,
      attemptCount: 0,
      latest: null,
    },
    NOW,
  );

  assert.match(text, /haven't run/);
  assert.match(evidence.join(" "), /no attempts · 3 checks to pass/);
});

test("a failed run names the check, and never the fix", () => {
  const { text, evidence } = derivedBrief(
    {
      kind: "exercise",
      title: "Total a cart",
      totalChecks: 3,
      attemptCount: 4,
      latest: {
        passed: false,
        proven: false,
        failedChecks: ["sums line items"],
        passedChecks: 2,
        at: new Date("2026-08-07T12:00:00Z"),
        hintsUsed: 2,
      },
    },
    NOW,
  );

  assert.match(text, /sums line items/);
  assert.match(text, /without giving you the fix/);
  assert.match(evidence[0], /4 attempts · last 2d ago · 2\/3 checks passing/);
  assert.match(evidence[1], /2 hints taken/);
});

test("a pass distinguishes proven from solution-revealed", () => {
  const base = {
    kind: "exercise",
    title: "Total a cart",
    totalChecks: 3,
    attemptCount: 2,
    latest: {
      passed: true,
      proven: true,
      failedChecks: [],
      passedChecks: 3,
      at: NOW,
      hintsUsed: 0,
    },
  };

  assert.match(derivedBrief(base, NOW).text, /no hints, no solution revealed/);
  assert.match(
    derivedBrief({ ...base, latest: { ...base.latest, proven: false } }, NOW).text,
    /isn't marked proven/,
  );
});

test("progress leads with the repeated failure, not the tally", () => {
  const { text, evidence } = derivedBrief(
    {
      kind: "progress",
      proven: 2,
      shaky: 1,
      untested: 5,
      dueRecall: 3,
      topFailure: { check: "no DML in loops", exercise: "Bulk insert", times: 4 },
      proposed: "Bulk insert",
    },
    NOW,
  );

  assert.match(text, /no DML in loops/);
  assert.match(text, /4×/);
  assert.match(evidence[0], /2 proven · 1 shaky · 5 untested/);
});

test("a single failure is not called a pattern", () => {
  const { text } = derivedBrief(
    {
      kind: "progress",
      proven: 0,
      shaky: 0,
      untested: 4,
      dueRecall: 0,
      topFailure: { check: "no DML in loops", exercise: "Bulk insert", times: 1 },
      proposed: null,
    },
    NOW,
  );

  assert.ok(!text.includes("no DML in loops"), "one failure is not a pattern");
  assert.match(text, /haven't proven anything yet/);
});

test("an unanswered thread is described as unanswered", () => {
  const { text } = derivedBrief(
    { kind: "thread", title: "Why twice?", replies: 0, lastReplyAt: null, unanswered: true },
    NOW,
  );
  assert.match(text, /Nobody has replied/);
});

test("a lesson brief points at what would prove it", () => {
  const { text, evidence } = derivedBrief(
    {
      kind: "lesson",
      title: "Bulkification",
      hasTranscript: true,
      completedAt: new Date("2026-08-08T12:00:00Z"),
      exercises: [{ title: "Bulk insert", proven: false, attempted: true }],
    },
    NOW,
  );

  assert.match(text, /Bulk insert/);
  assert.match(text, /You've attempted/);
  assert.match(evidence.join(" "), /transcript read/);
  assert.match(evidence.join(" "), /marked complete yesterday/);
});
