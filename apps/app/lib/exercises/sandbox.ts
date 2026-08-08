/**
 * Transport for `runTests`: put the files in a microVM, run the harness, bring
 * stdout back. All of the judgement about what the output *means* lives in
 * `harness.ts` — this file only has to be careful.
 *
 * Auth is the same mechanism the app already uses for model calls: on Vercel
 * the deployment's OIDC token is picked up automatically, so there is no key to
 * manage. Off-Vercel it needs VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID,
 * and without either we degrade instead of crashing (see lib/notify.ts).
 */

import { Sandbox } from "@vercel/sandbox";
import {
  HARNESS_PATH,
  RUN_TIMEOUT_MS,
  countMarkers,
  filesToWrite,
  parseHarnessOutput,
  truncate,
} from "./harness";
import type { LanguagePlan } from "./harness";
import type { ExerciseFile, TestResult } from "./runner";

/** Sandbox lifetime. Generous against the run timeout so the run reports first. */
const SANDBOX_TIMEOUT_MS = RUN_TIMEOUT_MS + 30_000;

export function isConfigured(): boolean {
  return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN);
}

export type RunOutcome =
  | { ok: true; results: TestResult[] }
  | { ok: false; message: string };

export async function runInSandbox(
  plan: LanguagePlan,
  submitted: ExerciseFile[],
  testFiles: ExerciseFile[],
): Promise<RunOutcome> {
  let sandbox: Sandbox | undefined;

  try {
    sandbox = await Sandbox.create({
      runtime: plan.runtime,
      timeout: SANDBOX_TIMEOUT_MS,
      // Submissions are untrusted code. Nothing here needs the network, and a
      // test that can reach the internet is a test that can exfiltrate the
      // reference solution or phone a model for the answer.
      networkPolicy: "deny-all",
    });

    await sandbox.writeFiles(filesToWrite(submitted, testFiles));

    const command = await sandbox.runCommand(plan.cmd, plan.args, {
      timeoutMs: RUN_TIMEOUT_MS,
    });

    const stdout = await command.stdout();
    const results = parseHarnessOutput(stdout);
    if (results) return { ok: true, results };

    // More than one marker means the submission printed its own result payload.
    // Say so plainly rather than reporting a test failure it can argue with.
    if (countMarkers(stdout) > 1) {
      return {
        ok: false,
        message:
          "This run produced more than one set of results, so none of them can be trusted. Submitted code must not write the runner's own output.",
      };
    }

    // No marker: the process died before reporting. Prefer stderr in the
    // explanation — for a syntax error or a stack overflow that is the only
    // place the actual reason appears.
    const stderr = truncate(await command.stderr(), 400);
    if (command.exitCode !== 0) {
      return {
        ok: false,
        message: stderr
          ? `Your code didn't finish running (exit ${command.exitCode}): ${stderr}`
          : `Your code didn't finish running (exit ${command.exitCode}).`,
      };
    }
    return {
      ok: false,
      message:
        "The run ended without reporting any results — most often an infinite loop, or code that exits the process itself.",
    };
  } catch (err) {
    // Provisioning failed, the run outlived the sandbox, or the API refused
    // us. None of these are the learner's fault, and none of them are a pass.
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[exercise-runner] ${HARNESS_PATH} failed:`, err);
    return {
      ok: false,
      message: `Tests could not be run just now — this is on us, not on your code. (${truncate(detail, 200)})`,
    };
  } finally {
    // Best effort: a leaked sandbox costs money and the run is already over.
    await sandbox?.stop().catch(() => {});
  }
}
