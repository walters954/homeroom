import type { Exercise } from "@homeroom/db";
import { allFailed, planFor, reconcile, unsupportedMessage } from "./harness";
import { isConfigured, runInSandbox } from "./sandbox";

/** One file in an attempt or in an exercise's starter/solution set. */
export interface ExerciseFile {
  path: string;
  contents: string;
}

/** One row of `Exercise.testSpec` — what the exercise claims it checks. */
export interface TestSpecItem {
  name: string;
  description?: string;
}

/** One row of `Submission.testResults` — what actually happened on a run. */
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

/**
 * The seam execution plugs into. Everything that records a submission calls
 * this and nothing else, so swapping the backend stays a one-file change.
 */
export type TestRunner = (
  exercise: Pick<Exercise, "id" | "language" | "testSpec" | "testFiles">,
  files: ExerciseFile[],
) => Promise<TestResult[]>;

export function parseFiles(value: unknown): ExerciseFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((f) => {
    if (!f || typeof f !== "object") return [];
    const { path, contents } = f as Record<string, unknown>;
    if (typeof path !== "string") return [];
    return [{ path, contents: typeof contents === "string" ? contents : "" }];
  });
}

export function parseTestSpec(value: unknown): TestSpecItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((t) => {
    if (!t || typeof t !== "object") return [];
    const { name, description } = t as Record<string, unknown>;
    if (typeof name !== "string") return [];
    return [
      { name, description: typeof description === "string" ? description : undefined },
    ];
  });
}

export function parseTestResults(value: unknown): TestResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const { name, passed, message } = r as Record<string, unknown>;
    if (typeof name !== "string") return [];
    return [
      {
        name,
        passed: passed === true,
        message: typeof message === "string" ? message : "",
      },
    ];
  });
}

export const NOT_CONFIGURED_MESSAGE =
  "Test execution isn't configured on this deployment.";

export const NO_TESTS_MESSAGE =
  "This exercise has no test files yet, so nothing can be verified.";

/**
 * Run a submission against the exercise's hidden tests.
 *
 * Every path out of here that is not a genuine green is a failure, including
 * the ones that are our fault. That asymmetry is deliberate: the product
 * measures competence by whether tests actually passed, and one fabricated
 * pass would set a PROVEN skill state, seed a recall schedule and unlock the
 * worked solution off nothing. Admins keep a manual override for the languages
 * that cannot run yet.
 */
export const runTests: TestRunner = async (exercise, files) => {
  const spec = parseTestSpec(exercise.testSpec);

  const plan = planFor(exercise.language);
  if (!plan) return allFailed(spec, unsupportedMessage(exercise.language));

  const testFiles = parseFiles(exercise.testFiles);
  if (testFiles.length === 0) return allFailed(spec, NO_TESTS_MESSAGE);

  if (!isConfigured()) return allFailed(spec, NOT_CONFIGURED_MESSAGE);

  const outcome = await runInSandbox(plan, files, testFiles);
  return outcome.ok
    ? reconcile(spec, outcome.results)
    : allFailed(spec, outcome.message);
};
