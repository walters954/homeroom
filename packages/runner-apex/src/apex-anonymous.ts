/**
 * Running Apex exercises as one anonymous block in the learner's own org
 * (issue #29).
 *
 * Nothing is deployed. That is the whole reason this approach was chosen over a
 * scratch org per submission: no class-name collisions between two learners, no
 * pool to lease, no cleanup, and feedback in seconds rather than minutes.
 *
 * The shape follows what Lightning Challenges has been running in production,
 * because several of the constraints here are non-obvious Apex rules rather
 * than choices:
 *
 * - **Submitted code goes inside the wrapper class.** Apex forbids static
 *   members on inner classes, but a class declared at the top of an anonymous
 *   block may have them — so putting the learner's code inside the wrapper is
 *   what keeps their `static` legal.
 * - **Checks record, they don't assert.** `System.AssertException` cannot be
 *   caught in ordinary Apex, so an assertion-based check would abort the block
 *   instead of reporting. Checks call `record(...)` and throw only by accident.
 * - **Results leave through an exception.** An anonymous block returns compile
 *   status and an error string, nothing else, so the only way out with a
 *   structured payload is to throw one.
 * - **DML is real.** Anonymous Apex is not test context, so a savepoint and a
 *   rollback in a `finally` is what stops an exercise leaving records behind.
 *
 * No imports, so `apex-anonymous.test.mjs` can load it directly.
 */

import type { ExerciseFile, TestResult } from "@homeroom/exercise-runner";

/** Precedes the JSON payload inside the thrown exception's message. */
export const APEX_SENTINEL = "__HOMEROOM_APEX__";

const MAX_MESSAGE = 1_000;

function truncate(value: string, max = MAX_MESSAGE): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

/** Apex identifiers, which is what a check's file name has to reduce to. */
function methodNameOf(path: string): string | null {
  const base = (path.split("/").pop() ?? "").replace(/\.(cls|apex)$/i, "");
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(base) ? base : null;
}

/** Apex string literal — single quotes and backslashes are the escapes. */
function apexString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * A savepoint cannot be held across a callout, so an exercise that makes one
 * has to run without the rollback. Detected rather than configured: an author
 * who forgets a flag would otherwise get an uncatchable runtime error instead
 * of a test failure.
 */
export function usesCallouts(sources: string[]): boolean {
  return sources.some((s) => /\bHttp(Request|Response|Calloutmock)?\b|\bWebServiceCallout\b/i.test(s));
}

export interface ApexBlock {
  code: string;
  /** Check names in the order they will run — the reconciliation keys. */
  checks: string[];
  /** False when DML will not be rolled back, because the code makes callouts. */
  rollsBack: boolean;
}

/**
 * Assemble the block.
 *
 * Each check is invoked in its own try/catch so one failure cannot hide the
 * rest, and so an exception can be attributed to the check that threw. A check
 * that records nothing still reconciles as "did not run" upstream, which is a
 * failure — never an absence.
 */
export function buildAnonymousApex(
  submitted: ExerciseFile[],
  checkFiles: ExerciseFile[],
): ApexBlock {
  const checks: { name: string; body: string }[] = [];
  for (const file of checkFiles) {
    const name = methodNameOf(file.path);
    if (name) checks.push({ name, body: file.contents });
  }

  const rollsBack = !usesCallouts([
    ...submitted.map((f) => f.contents),
    ...checkFiles.map((f) => f.contents),
  ]);

  const invocations = checks
    .map(
      ({ name }) => `      try {
        this.${name}();
      } catch (Exception e) {
        hrRecord(${apexString(name)}, false, e.getTypeName() + ': ' + e.getMessage() + ' (line ' + e.getLineNumber() + ')');
      }`,
    )
    .join("\n");

  const code = `public static List<Object> hrChecks = new List<Object>();
public class HomeroomResultException extends Exception {}

public class HomeroomAttempt {
  // === submitted ===
${submitted.map((f) => f.contents).join("\n\n")}
  // === checks ===
${checks.map((c) => c.body).join("\n\n")}

  public void hrRecord(String name, Boolean pass, String message) {
    hrChecks.add(new Map<String, Object>{
      'name' => name,
      'passed' => pass,
      // A passing check has nothing to explain, and an author who builds the
      // message before knowing the outcome would otherwise report
      // "expected 6, got 6" beside a green tick.
      'message' => (pass == true ? '' : message)
    });
  }

  public void hrRunAll() {
${rollsBack ? "    Savepoint hrSp = Database.setSavepoint();\n" : ""}    try {
${invocations}
    } finally {
${rollsBack ? "      Database.rollback(hrSp);\n" : "      // callouts present: no savepoint, so DML is not rolled back\n"}    }
  }
}

HomeroomAttempt hrAttempt = new HomeroomAttempt();
hrAttempt.hrRunAll();
throw new HomeroomResultException(${apexString(APEX_SENTINEL)} + JSON.serialize(hrChecks));
`;

  return { code, checks: checks.map((c) => c.name), rollsBack };
}

/** What `POST /tooling/executeAnonymous` gives back, as far as we rely on it. */
export interface ExecuteAnonymousResponse {
  compiled?: boolean;
  success?: boolean;
  compileProblem?: string | null;
  exceptionMessage?: string | null;
  exceptionStackTrace?: string | null;
  line?: number | null;
  column?: number | null;
}

export type ApexOutcome =
  | { ok: true; results: TestResult[] }
  | { ok: false; message: string };

/**
 * Read the run back.
 *
 * Positive evidence only, like the JS harness: results count only when they
 * arrive inside our sentinel. A block that failed to compile, threw before
 * reporting, or came back in a shape we do not recognise is a failure with an
 * explanation — never an empty green run.
 */
export function readAnonymousResult(
  response: ExecuteAnonymousResponse,
): ApexOutcome {
  if (response.compiled === false) {
    const problem = truncate(response.compileProblem ?? "", 600);
    const where =
      response.line != null ? ` (line ${response.line}, column ${response.column ?? 0})` : "";
    return {
      ok: false,
      message: problem
        ? `Your Apex didn't compile${where}: ${problem}`
        : `Your Apex didn't compile${where}.`,
    };
  }

  const raw = response.exceptionMessage ?? "";
  const at = raw.indexOf(APEX_SENTINEL);

  if (at === -1) {
    // Salesforce prefixes the class name onto an exception message, so the
    // sentinel is searched for rather than matched at the start. Absent
    // entirely means the block died before it could report.
    const detail = truncate(raw, 400);
    return {
      ok: false,
      message: detail
        ? `The run stopped before reporting any results: ${detail}`
        : "The run ended without reporting any results, so nothing here can be counted as a pass.",
    };
  }

  const payload = raw.slice(at + APEX_SENTINEL.length).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return {
      ok: false,
      message:
        "The results came back in a form we couldn't read, so nothing here can be counted as a pass. This is on us — an admin can record a pass manually.",
    };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: "The results came back in an unexpected shape." };
  }

  const results: TestResult[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.name !== "string") continue;
    results.push({
      name: row.name,
      passed: row.passed === true,
      message: typeof row.message === "string" ? truncate(row.message) : "",
    });
  }

  return results.length > 0
    ? { ok: true, results }
    : {
        ok: false,
        message: "The run reported no checks at all, which is not a pass.",
      };
}
