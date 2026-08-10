/**
 * Which runners this deployment has, and nothing else.
 *
 * The seam, the reconciliation and the rule that every non-green path is a
 * failure all live in `@homeroom/exercise-runner`; each language lives in its
 * own package (#63). Adding a language is adding an entry to this array — and
 * a school that teaches only TypeScript can drop the Apex one without touching
 * anything else.
 */

import {
  runWith,
  type ExerciseFile,
  type RunnableExercise,
  type TestResult,
} from "@homeroom/exercise-runner";
import { apexRunner } from "@homeroom/runner-apex";
import { sandboxRunner } from "@homeroom/runner-sandbox";

const RUNNERS = [sandboxRunner, apexRunner];

export function runTests(
  exercise: RunnableExercise,
  files: ExerciseFile[],
  userId: string,
): Promise<TestResult[]> {
  return runWith(RUNNERS, exercise, files, userId);
}

/** Whether an attempt could be verified at all — for authoring surfaces. */
export function canRun(language: RunnableExercise["language"]): boolean {
  return RUNNERS.some((r) => r.languages.includes(language));
}
