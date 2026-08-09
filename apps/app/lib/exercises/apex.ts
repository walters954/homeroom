/**
 * Apex execution, minus the org (issue #29).
 *
 * Everything here is the part of running Apex that does not need Salesforce
 * credentials: laying out an SFDX project, deciding which classes to run, and
 * reading the CLI's JSON back. It is separated from the transport for the same
 * reason `harness.ts` is separated from `sandbox.ts` — this is where a learner
 * is told the truth or isn't, and it should be testable without provisioning
 * anything.
 *
 * **The parser is written to be wrong safely.** The exact shape of
 * `sf apex run test --json` is not publicly documented, so the reader below
 * demands positive evidence of a pass — a recognised test row whose `Outcome`
 * is exactly `Pass` — and treats everything it does not understand as a
 * failure. If Salesforce changes the payload or these field names are wrong,
 * the result is every declared test failing with "could not be read", which an
 * admin can override. The opposite bias would hand out PROVEN marks for code
 * nobody ran.
 */

import type { ExerciseFile, TestResult } from "./runner";

/** Long enough to diagnose a failure, short enough not to bloat every row. */
const MAX_MESSAGE = 1_000;

/**
 * Local rather than imported from `harness.ts` so this module has no runtime
 * imports at all: `apex.test.mjs` loads it directly under `node --test`, which
 * resolves extensionless specifiers the way neither Node nor tsc agree on.
 * Same reason `lib/tutor/context.ts` stands alone.
 */
function truncate(value: string, max = MAX_MESSAGE): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

/** Matches the CLI's default source layout, so no path config is needed. */
export const CLASS_DIR = "force-app/main/default/classes";

/** Bumping this is a deliberate act: authored Apex may depend on the version. */
export const API_VERSION = "62.0";

/** A run that hasn't finished by now is a runaway test, not a slow org. */
export const APEX_RUN_TIMEOUT_MS = 300_000;

/** Apex class names are unqualified identifiers; anything else isn't one. */
export function isApexClassName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}

/**
 * The class name a file will deploy as. Apex has no notion of directories —
 * `Foo.cls` is class `Foo` wherever the author filed it — so the basename is
 * the whole of the identity, and a file whose basename isn't a legal class name
 * cannot be deployed at all.
 */
export function classNameOf(path: string): string | null {
  const base = path.split("/").pop() ?? "";
  if (!base.toLowerCase().endsWith(".cls")) return null;
  const name = base.slice(0, -".cls".length);
  return isApexClassName(name) ? name : null;
}

function metaXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${API_VERSION}</apiVersion>
    <status>Active</status>
</ApexClass>
`;
}

export interface ProjectFile {
  path: string;
  content: string;
}

/**
 * The SFDX project to deploy: every class flattened into one directory, each
 * with the `-meta.xml` the Metadata API requires, plus a minimal
 * `sfdx-project.json`.
 *
 * Only what the caller passes is written. `Exercise.solutionFiles` is not a
 * parameter and must never become one — deploying the reference solution into
 * the same org as the submission would put the answer one SOQL query against
 * `ApexClass.Body` away from any learner who thought to look.
 */
export function apexProjectFiles(
  submitted: ExerciseFile[],
  testFiles: ExerciseFile[],
): ProjectFile[] {
  const files: ProjectFile[] = [
    {
      path: "sfdx-project.json",
      content: JSON.stringify(
        {
          packageDirectories: [{ path: "force-app", default: true }],
          namespace: "",
          sfdcLoginUrl: "https://login.salesforce.com",
          sourceApiVersion: API_VERSION,
        },
        null,
        2,
      ),
    },
  ];

  // Later wins, so a learner cannot shadow a test class by submitting a file
  // with its name: the tests are written last.
  const byClass = new Map<string, string>();
  for (const file of [...submitted, ...testFiles]) {
    const name = classNameOf(file.path);
    if (name) byClass.set(name, file.contents);
  }

  for (const [name, contents] of byClass) {
    files.push({ path: `${CLASS_DIR}/${name}.cls`, content: contents });
    files.push({ path: `${CLASS_DIR}/${name}.cls-meta.xml`, content: metaXml() });
  }

  return files;
}

/** Which classes to hand `--class-names`. Only the exercise's own tests run. */
export function testClassNames(testFiles: ExerciseFile[]): string[] {
  return [
    ...new Set(
      testFiles.flatMap((f) => {
        const name = classNameOf(f.path);
        return name ? [name] : [];
      }),
    ),
  ];
}

/** How a result row names itself, so `testSpec` can be written to match. */
function rowName(row: Record<string, unknown>): string | null {
  if (typeof row.FullName === "string" && row.FullName) return row.FullName;

  const apexClass = row.ApexClass as Record<string, unknown> | undefined;
  const className = apexClass && typeof apexClass.Name === "string" ? apexClass.Name : null;
  const method = typeof row.MethodName === "string" ? row.MethodName : null;
  if (className && method) return `${className}.${method}`;
  return method;
}

/**
 * Why a row that isn't a pass isn't a pass. `CompileFail` is worth separating:
 * it means the code never ran, which reads very differently to an assertion
 * that fired.
 */
function rowMessage(row: Record<string, unknown>, outcome: string): string {
  const message = typeof row.Message === "string" ? row.Message : "";
  const stack = typeof row.StackTrace === "string" ? row.StackTrace : "";

  if (outcome === "CompileFail") {
    return truncate(message || "This class did not compile.");
  }
  if (outcome === "Skip") {
    return "This test was skipped, so it did not prove anything.";
  }
  const detail = [message, stack].filter(Boolean).join("\n");
  return truncate(detail || `The test did not pass (outcome: ${outcome}).`);
}

/**
 * Read `sf apex run test --json` output.
 *
 * Returns `null` when the payload cannot be understood as a test run at all —
 * the caller turns that into every declared test failing, never a pass.
 */
export function parseApexTestOutput(stdout: string): TestResult[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const envelope = parsed as Record<string, unknown>;
  const result = envelope.result as Record<string, unknown> | undefined;
  const rows = result?.tests;
  if (!Array.isArray(rows)) return null;

  const results: TestResult[] = [];
  for (const entry of rows) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = rowName(row);
    if (!name) continue;

    // Positive evidence only. An outcome we don't recognise is not a pass.
    const outcome = typeof row.Outcome === "string" ? row.Outcome : "";
    const passed = outcome === "Pass";

    results.push({
      name,
      passed,
      message: passed ? "" : rowMessage(row, outcome || "unknown"),
    });
  }

  // A payload we parsed but found no recognisable test in is not an empty
  // green run — it is a payload we do not understand.
  return results.length > 0 ? results : null;
}

/**
 * Deploy errors are the exercise's problem or the learner's, and the two read
 * very differently — a compile error in submitted code is feedback, while a
 * broken test class is a bug to report.
 */
export function deployFailureMessage(raw: string): string {
  const detail = truncate(raw, 600);
  return detail
    ? `Your Apex didn't deploy, so the tests never ran: ${detail}`
    : "Your Apex didn't deploy, so the tests never ran.";
}

export const APEX_UNREADABLE_MESSAGE =
  "The test run came back in a form we couldn't read, so nothing here can be counted as a pass. This is on us — an admin can record a pass manually.";

export const APEX_NOT_CONFIGURED_MESSAGE =
  "Apex tests need a Salesforce org, and this deployment doesn't have one connected yet (issue #29). An admin can record a pass manually.";
