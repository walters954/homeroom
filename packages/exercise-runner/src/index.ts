/**
 * The seam every exercise language plugs into.
 *
 * This package holds the one rule that must never be re-implemented per
 * language: **every path that is not a genuine green is a failure, including
 * the ones that are our fault.** A fabricated pass sets a PROVEN skill state,
 * seeds a recall schedule and unlocks the worked solution off nothing, so a
 * contributed runner is not trusted to decide what its own silence means.
 * Runners report an outcome; `runWith` decides what that outcome is worth.
 *
 * A language is more than a function that runs files — Apex needed credentials
 * per learner, a setup surface and its own authoring rules — so a runner
 * declares what it needs rather than being asked to fit one signature.
 */

import type { ExerciseLanguage } from "@homeroom/db";

/** One file in an attempt, or in an exercise's starter/solution set. */
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

/** What a runner reports. Never "pass" by omission. */
export type RunOutcome =
  | { ok: true; results: TestResult[] }
  | { ok: false; message: string };

export interface RunRequest {
  /** What the learner submitted. */
  files: ExerciseFile[];
  /** The exercise's hidden checks. Never its reference solution. */
  testFiles: ExerciseFile[];
  /** Whose attempt this is — for runners needing per-learner credentials. */
  userId: string;
}

export interface LanguageRunner {
  /** For diagnostics and the contribution docs. */
  name: string;
  languages: ExerciseLanguage[];
  /**
   * Whether this deployment has what the runner needs — a sandbox token, a
   * connected org. False degrades to an honest failure, never a crash.
   */
  isConfigured(request: RunRequest): boolean | Promise<boolean>;
  /** Shown when `isConfigured` is false. Says what is missing, in plain words. */
  notConfiguredMessage: string;
  run(request: RunRequest): Promise<RunOutcome>;
}

const MAX_MESSAGE = 1_000;

export function truncate(value: string, max = MAX_MESSAGE): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

/**
 * Reject anything that would write outside the working directory. Authored
 * paths are creator-controlled today, but the exercise editor makes them
 * learner-adjacent, and this is the wrong thing to add later.
 */
export function isSafePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  return !path.split("/").some((seg) => seg === ".." || seg === "");
}

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

/**
 * Reconcile what ran against what the exercise claims it checks.
 *
 * `testSpec` is the contract shown to the learner, so it decides the shape of
 * the result: a spec item nothing reported on counts as failed, never as
 * absent. Without this, a run that silently skipped half its checks would
 * report all-green on the half that ran.
 */
export function reconcile(
  spec: TestSpecItem[],
  reported: TestResult[],
): TestResult[] {
  if (spec.length === 0) return reported;

  const byName = new Map(reported.map((r) => [r.name, r]));
  const claimed = spec.map(
    (item) =>
      byName.get(item.name) ?? {
        name: item.name,
        passed: false,
        message: "This test did not run.",
      },
  );

  const specNames = new Set(spec.map((s) => s.name));
  const extra = reported.filter((r) => !specNames.has(r.name));
  return [...claimed, ...extra];
}

/** Every declared test, failed, with one shared explanation. */
export function allFailed(spec: TestSpecItem[], message: string): TestResult[] {
  const names = spec.length > 0 ? spec.map((s) => s.name) : ["tests"];
  return names.map((name) => ({ name, passed: false, message }));
}

export const NO_TESTS_MESSAGE =
  "This exercise has no test files yet, so nothing can be verified.";

export function unsupportedMessage(language: ExerciseLanguage): string {
  return `Test execution for ${language.toLowerCase()} isn't wired up yet, so this can't be verified here. An admin can record a pass manually.`;
}

export interface RunnableExercise {
  language: ExerciseLanguage;
  testSpec: unknown;
  testFiles: unknown;
}

/**
 * Run a submission through whichever runner claims its language.
 *
 * Every failure path lands here rather than in a runner: no runner for the
 * language, no checks authored, the deployment not configured, or a runner
 * reporting `ok: false`. Each becomes every declared test failing with the
 * reason — which an admin can override, and which can never be mistaken for a
 * pass.
 */
export async function runWith(
  runners: LanguageRunner[],
  exercise: RunnableExercise,
  files: ExerciseFile[],
  userId: string,
): Promise<TestResult[]> {
  const spec = parseTestSpec(exercise.testSpec);

  const runner = runners.find((r) => r.languages.includes(exercise.language));
  if (!runner) return allFailed(spec, unsupportedMessage(exercise.language));

  const testFiles = parseFiles(exercise.testFiles);
  if (testFiles.length === 0) return allFailed(spec, NO_TESTS_MESSAGE);

  const request: RunRequest = { files, testFiles, userId };
  if (!(await runner.isConfigured(request))) {
    return allFailed(spec, runner.notConfiguredMessage);
  }

  const outcome = await runner.run(request);
  return outcome.ok
    ? reconcile(spec, outcome.results)
    : allFailed(spec, outcome.message);
}
