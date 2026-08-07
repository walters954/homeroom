import type { Exercise } from "@homeroom/db";

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
 * The seam a real sandbox plugs into. Everything that records a submission
 * calls this and nothing else, so wiring up execution is a one-file change.
 */
export type TestRunner = (
  exercise: Pick<Exercise, "id" | "language" | "testSpec">,
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

export const NOT_WIRED_MESSAGE = "Test execution isn't wired up yet.";

/**
 * TODO(#7): replace with sandboxed execution (see GitHub issue #7 —
 * "in-browser editor + test-verified exercises", track:technical-courses).
 *
 * Until that lands this reports every test as failing rather than inventing a
 * pass. A fabricated green is worse than no runner: the whole product measures
 * competence by whether tests genuinely passed, and one fake pass would set a
 * PROVEN skill state, seed a recall schedule, and unlock the worked solution
 * off nothing. Admins have a manual override for demos instead.
 */
export const runTests: TestRunner = async (exercise) => {
  const spec = parseTestSpec(exercise.testSpec);
  const tests: TestSpecItem[] =
    spec.length > 0 ? spec : [{ name: "tests", description: undefined }];

  return tests.map((t) => ({
    name: t.name,
    passed: false,
    message: NOT_WIRED_MESSAGE,
  }));
};
