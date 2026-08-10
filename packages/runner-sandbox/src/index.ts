/**
 * JavaScript and TypeScript, executed in a Vercel Sandbox microVM.
 *
 * The submission is untrusted code, so the microVM is the boundary: `deny-all`
 * egress, because a test that can reach the internet is a test that can
 * exfiltrate the reference solution or ask a model for the answer.
 */

import type { LanguageRunner, RunOutcome, RunRequest } from "@homeroom/exercise-runner";
import { isConfigured, runInSandbox } from "./sandbox";
import { planFor } from "./harness";

export const sandboxRunner: LanguageRunner = {
  name: "sandbox",
  languages: ["JAVASCRIPT", "TYPESCRIPT"],
  isConfigured: () => isConfigured(),
  notConfiguredMessage:
    "Test execution isn't configured on this deployment, so this can't be verified. An admin can record a pass manually.",
  async run({ files, testFiles }: RunRequest): Promise<RunOutcome> {
    // Both land on node24 — it strips TypeScript types natively.
    const plan = planFor("TYPESCRIPT");
    if (!plan) {
      return { ok: false, message: "No execution plan for this language." };
    }
    return runInSandbox(plan, files, testFiles);
  },
};

export { planFor } from "./harness";
export type { LanguagePlan } from "./harness";
