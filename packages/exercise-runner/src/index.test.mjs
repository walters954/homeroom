/**
 * The rules every language runner inherits, and which none of them may
 * re-implement: reconciliation against the exercise's declared contract, the
 * all-failed shape, and path safety. Run with Node 24.
 *
 * These moved here from the sandbox runner's tests when the seam was extracted
 * (#63) — they were never about JavaScript, they were about honesty.
 */

import assert from "node:assert";
import test from "node:test";

import { allFailed, isSafePath, reconcile } from "./index.ts";

const SPEC = [{ name: "adds two numbers" }, { name: "handles negatives" }];

test("a spec row nothing reported on counts as failed", () => {
  const results = reconcile(SPEC, [{ name: "adds two numbers", passed: true, message: "" }]);
  assert.strictEqual(results[1].passed, false);
  assert.strictEqual(results[1].message, "This test did not run.");
});

test("tests outside the spec are kept, not dropped", () => {
  const results = reconcile(SPEC, [
    { name: "adds two numbers", passed: true, message: "" },
    { name: "handles negatives", passed: true, message: "" },
    { name: "undeclared", passed: false, message: "boom" },
  ]);
  assert.strictEqual(results.length, 3);
  assert.strictEqual(results[2].name, "undeclared");
});

test("paths that escape the working directory are refused", () => {
  assert.ok(!isSafePath("../../etc/passwd"));
  assert.ok(!isSafePath("/etc/passwd"));
  assert.ok(!isSafePath("a//b.js"));
  assert.ok(isSafePath("src/a.js"));
});

test("allFailed fails every declared test with one reason", () => {
  const results = allFailed(SPEC, "nope");
  assert.strictEqual(results.length, 2);
  assert.ok(results.every((r) => !r.passed && r.message === "nope"));
});
