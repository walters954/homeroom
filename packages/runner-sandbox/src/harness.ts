/**
 * Everything about running an exercise that does not need a sandbox.
 *
 * Kept separate from `sandbox.ts` on purpose: the protocol, the reconciliation
 * against `testSpec`, and the failure wording are the parts that decide whether
 * a learner is told the truth, and they are worth being able to exercise
 * without provisioning a microVM. `sandbox.ts` is then only transport.
 */

import type { ExerciseLanguage } from "@homeroom/db";
import { isSafePath, truncate } from "@homeroom/exercise-runner";
import type { ExerciseFile, TestResult } from "@homeroom/exercise-runner";

/**
 * Printed by the harness immediately before the JSON payload. A marker rather
 * than "parse the last line" because a submission is free to print whatever it
 * likes, including something that looks like our output.
 */
export const RESULT_MARKER = "__HOMEROOM_RESULTS__";

/** Where the sandbox drops us, and where every path below is resolved from. */
export const SANDBOX_CWD = "/vercel/sandbox";

/** Unlikely to collide with an authored path, and obvious in a file tree. */
export const HARNESS_PATH = "__homeroom/run.mjs";

/** A submission that has not finished by now is a submission with a loop in it. */
export const RUN_TIMEOUT_MS = 60_000;

export interface LanguagePlan {
  runtime: "node24" | "python3.13";
  cmd: string;
  args: string[];
}

/**
 * How each language is executed, or `null` if we cannot honestly run it yet.
 *
 * Apex is deliberately absent rather than approximated: it has no runtime
 * outside Salesforce, and a JS lookalike that "mostly" behaves like Apex would
 * hand out proven marks for code that would fail in an org. See issue #29.
 */
export function planFor(language: ExerciseLanguage): LanguagePlan | null {
  switch (language) {
    case "JAVASCRIPT":
    case "TYPESCRIPT":
      // node24 strips TypeScript types natively, so both land on one runtime.
      return { runtime: "node24", cmd: "node", args: [HARNESS_PATH] };
    default:
      return null;
  }
}

/**
 * The harness the sandbox actually executes.
 *
 * A test file default-exports `[{ name, run }]`. `run` throws to fail — which
 * makes `node:assert` the whole assertion library and keeps authored tests free
 * of any dependency we would have to install per run.
 */
export function buildHarness(testFiles: ExerciseFile[]): string {
  const specifiers = JSON.stringify(testFiles.map((f) => f.path));

  return `import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const files = ${specifiers};
const results = [];

function message(err) {
  if (err && typeof err.message === "string" && err.message) return err.message;
  return String(err);
}

for (const file of files) {
  let mod;
  try {
    mod = await import(pathToFileURL(resolve(file)).href);
  } catch (err) {
    // A test file that will not even load is a broken exercise, not a failed
    // attempt — say which file, so the creator can tell the two apart.
    results.push({
      name: file,
      passed: false,
      message: "Test file failed to load: " + message(err),
    });
    continue;
  }

  const tests = Array.isArray(mod.default) ? mod.default : [];
  for (const test of tests) {
    const name = String(test?.name ?? "unnamed test");
    try {
      await test.run();
      results.push({ name, passed: true, message: "" });
    } catch (err) {
      results.push({ name, passed: false, message: message(err) });
    }
  }
}

process.stdout.write("\\n${RESULT_MARKER}" + JSON.stringify(results) + "\\n");
`;
}

/** Everything the sandbox needs on disk, in one write. */
export function filesToWrite(
  submitted: ExerciseFile[],
  testFiles: ExerciseFile[],
): { path: string; content: string }[] {
  return [
    ...submitted.filter((f) => isSafePath(f.path)),
    ...testFiles.filter((f) => isSafePath(f.path)),
    { path: HARNESS_PATH, contents: buildHarness(testFiles) },
  ].map((f) => ({ path: f.path, content: f.contents }));
}

/** How many times the marker appears. Exactly one is the only honest answer. */
export function countMarkers(stdout: string): number {
  return stdout.split(RESULT_MARKER).length - 1;
}

/**
 * Pull the JSON payload back out of stdout.
 *
 * Returns `null` unless the marker appears exactly once. Zero means the
 * submission never reported — it called `process.exit`, looped until the
 * timeout, or crashed the runtime. More than one means someone printed their
 * own: submitted code runs in this process and can register an `exit` handler
 * that writes a forged all-green payload *after* ours. Counting is what makes
 * that unprofitable, since the harness always writes exactly one and a forgery
 * can only ever add. Either way it is a failure, never a pass.
 */
export function parseHarnessOutput(stdout: string): TestResult[] | null {
  if (countMarkers(stdout) !== 1) return null;

  const at = stdout.indexOf(RESULT_MARKER);
  const payload = stdout.slice(at + RESULT_MARKER.length).trim();
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        name: typeof row.name === "string" ? row.name : "unnamed test",
        passed: row.passed === true,
        message: typeof row.message === "string" ? truncate(row.message) : "",
      };
    });
  } catch {
    return null;
  }
}

