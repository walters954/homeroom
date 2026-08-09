/**
 * The tutor's corpus is the whole of what it can teach from, so what stays out
 * of it is a product guarantee, not a detail. Run with Node 24:
 * `pnpm --filter @homeroom/app test`.
 *
 * The load-bearing case is the first one: an exercise row carries its hidden
 * tests and reference solution on the same object as the learner-visible
 * prompt, so the only thing standing between the answer key and the tutor is
 * that this function does not read those fields.
 */

import assert from "node:assert";
import test from "node:test";

import { exerciseContext, progressContext, threadContext } from "./context.ts";

const HIDDEN_TEST = "assert.equal(totalFor(cart), 42) // hidden test body";
const REFERENCE = "export const totalFor = (c) => c.reduce(sum) // the answer";

/** What a Prisma `Exercise` row actually looks like, answer key and all. */
function exerciseRow(overrides = {}) {
  return {
    title: "Total a cart",
    prompt: "Implement `totalFor` so it sums the line items.",
    language: "TS",
    starterFiles: [{ path: "src/cart.ts", contents: "export const totalFor = () => {}" }],
    testSpec: [
      { name: "sums line items", description: "adds each quantity × price" },
      { name: "handles an empty cart", description: "returns 0" },
    ],
    // Present on the row, and never to be passed through:
    testFiles: [{ path: "test/cart.test.ts", contents: HIDDEN_TEST }],
    solutionFiles: [{ path: "src/cart.ts", contents: REFERENCE }],
    attemptCount: 2,
    latest: null,
    ...overrides,
  };
}

test("the hidden tests and the reference solution never reach the tutor", () => {
  const context = exerciseContext(exerciseRow());

  assert.ok(!context.includes(HIDDEN_TEST), "hidden test body leaked");
  assert.ok(!context.includes(REFERENCE), "reference solution leaked");
  assert.ok(!context.includes("test/cart.test.ts"), "hidden test path leaked");
  // The learner-visible contract is fine — names, not implementations.
  assert.ok(context.includes("sums line items"));
});

test("a failed run is described by which named checks failed", () => {
  const context = exerciseContext(
    exerciseRow({
      attemptCount: 3,
      latest: {
        files: [{ path: "src/cart.ts", contents: "const totalFor = () => 0" }],
        passed: false,
        results: [
          { name: "sums line items", passed: false, message: "expected 42, got 0" },
          { name: "handles an empty cart", passed: true },
        ],
        hintsUsed: 1,
        at: new Date("2026-08-07T12:00:00Z"),
      },
    }),
    new Date("2026-08-09T12:00:00Z"),
  );

  assert.ok(context.includes("sums line items"));
  assert.ok(context.includes("expected 42, got 0"));
  assert.ok(context.includes("const totalFor = () => 0"), "their own code is fair game");
  assert.ok(context.includes("2 days ago"));
  assert.ok(context.includes("1 hint"));
  // Still no answer key, on the path where there is the most to leak.
  assert.ok(!context.includes(HIDDEN_TEST));
  assert.ok(!context.includes(REFERENCE));
});

test("with no submission the tutor is told it has seen no code", () => {
  const context = exerciseContext(exerciseRow());
  assert.ok(context.includes("not submitted anything yet"));
});

test("progress context carries the pattern, not just the tally", () => {
  const context = progressContext(
    {
      skills: [
        { name: "Bulkification", course: "Apex", status: "SHAKY", attemptCount: 4 },
      ],
      dueRecall: [
        {
          skillName: "Governor limits",
          dueAt: new Date("2026-08-08T12:00:00Z"),
          intervalDays: 7,
          streak: 2,
          lastResult: false,
        },
      ],
      repeatedFailures: [
        { exercise: "Bulk insert", skill: "Bulkification", check: "no DML in loops", times: 3 },
      ],
      proposed: { title: "Bulk insert", reason: "shaky, and last attempt failed" },
    },
    new Date("2026-08-09T12:00:00Z"),
  );

  assert.ok(context.includes("no DML in loops"));
  assert.ok(context.includes("failed 3×"));
  assert.ok(context.includes("last one missed"));
  assert.ok(context.includes("shaky, and last attempt failed"));
});

test("thread context includes the replies, not just the opening post", () => {
  const context = threadContext(
    {
      space: "apex",
      title: "Why does my trigger run twice?",
      author: "Dana",
      body: "It fires on both insert and update.",
      comments: [
        { author: "Sam", body: "Check your recursion guard.", at: new Date("2026-08-09T12:00:00Z") },
      ],
    },
    new Date("2026-08-09T12:00:00Z"),
  );

  assert.ok(context.includes("Why does my trigger run twice?"));
  assert.ok(context.includes("recursion guard"));
  assert.ok(context.includes("#apex"));
});
