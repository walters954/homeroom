/**
 * Checks for the parts of exercise execution that decide whether a learner is
 * told the truth. Run with Node 24: `pnpm --filter @homeroom/app test`.
 *
 * Deliberately plain `.mjs` against `node:test`: no test framework to install,
 * and no tsconfig change, since the app only typechecks TypeScript sources. The
 * submissions below run for real through the generated harness, because the
 * failure this guards against — a fabricated pass — is exactly the one a mocked
 * run would not catch.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import assert from "node:assert";
import test from "node:test";

import {
  HARNESS_PATH,
  allFailed,
  buildHarness,
  countMarkers,
  filesToWrite,
  isSafePath,
  parseHarnessOutput,
  reconcile,
} from "./harness.ts";

const TEST_FILE = `import assert from "node:assert";
import { sum } from "../sum.js";

export default [
  { name: "adds two numbers", run: () => assert.strictEqual(sum(2, 3), 5) },
  { name: "handles negatives", run: () => assert.strictEqual(sum(-2, 1), -1) },
];
`;

const SPEC = [{ name: "adds two numbers" }, { name: "handles negatives" }];

/** Write a submission plus the hidden tests to a temp dir and run the harness. */
function run(submitted) {
  const dir = mkdtempSync(join(tmpdir(), "homeroom-exercise-"));
  const files = filesToWrite(submitted, [
    { path: "tests/sum.test.js", contents: TEST_FILE },
  ]);

  for (const file of files) {
    const full = join(dir, file.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content);
  }

  let stdout = "";
  try {
    stdout = execFileSync("node", [HARNESS_PATH], { cwd: dir, encoding: "utf8" });
  } catch (err) {
    stdout = err.stdout ?? "";
  }
  return parseHarnessOutput(stdout);
}

test("a correct submission passes every test", () => {
  const results = run([{ path: "sum.js", contents: "export const sum = (a, b) => a + b;\n" }]);
  assert.ok(results);
  assert.ok(results.every((r) => r.passed));
});

test("results are per test, not per run", () => {
  // Right on the happy path, wrong on negatives — partial credit has to survive.
  const results = run([
    { path: "sum.js", contents: "export const sum = (a, b) => Math.abs(a) + Math.abs(b);\n" },
  ]);
  assert.strictEqual(results[0].passed, true);
  assert.strictEqual(results[1].passed, false);
  assert.match(results[1].message, /-1/);
});

test("code that will not parse is reported as a load failure", () => {
  const results = run([{ path: "sum.js", contents: "export const sum = (a b) =>\n" }]);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].passed, false);
  assert.match(results[0].message, /failed to load/);
});

test("a submission that exits the process reports nothing", () => {
  const results = run([
    { path: "sum.js", contents: "process.exit(0);\nexport const sum = () => 0;\n" },
  ]);
  assert.strictEqual(results, null);
});

test("a forged all-green payload invalidates the run", () => {
  // Submitted code shares the process with the harness, so it can print after
  // us. Counting markers is what stops that from becoming a PROVEN skill.
  const results = run([
    {
      path: "sum.js",
      contents: `const forged = JSON.stringify([
  { name: "adds two numbers", passed: true, message: "" },
  { name: "handles negatives", passed: true, message: "" },
]);
process.on("exit", () => {
  process.stdout.write("\\n__HOMEROOM_RESULTS__" + forged + "\\n");
});
export const sum = () => 0;
`,
    },
  ]);
  assert.strictEqual(results, null);
});

test("the harness emits exactly one marker", () => {
  assert.strictEqual(countMarkers(buildHarness([])), 1);
});

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
