/**
 * Transport for Apex: post one anonymous block to the learner's org and bring
 * the result back. All the judgement about what the result *means* lives in
 * `apex-anonymous.ts` — this file only has to be careful, the same split as
 * `harness.ts` and `sandbox.ts`.
 */

import { accessTokenFor } from "@/lib/salesforce/connect";
import { API_VERSION } from "@/lib/salesforce/connect";
import {
  buildAnonymousApex,
  readAnonymousResult,
  type ApexOutcome,
} from "./apex-anonymous";
import type { ExerciseFile } from "./runner";

/**
 * The Tooling API takes the block as a query parameter, so a large submission
 * becomes a long URL. Salesforce caps a request URI around 16 KB; refusing
 * early is better than a truncated block compiling into something that isn't
 * what the learner wrote.
 */
const MAX_ENCODED_BODY = 12_000;

export const NO_ORG_MESSAGE =
  "Apex runs in your own Salesforce org, and you haven't connected one yet. Connect a Trailhead Playground or a Developer Edition org above, then run this again.";

export async function runApexInLearnerOrg(
  userId: string,
  submitted: ExerciseFile[],
  checkFiles: ExerciseFile[],
): Promise<ApexOutcome> {
  const auth = await accessTokenFor(userId);
  if (!auth) return { ok: false, message: NO_ORG_MESSAGE };

  const { code } = buildAnonymousApex(submitted, checkFiles);
  const body = encodeURIComponent(code);
  if (body.length > MAX_ENCODED_BODY) {
    return {
      ok: false,
      message:
        "This submission is too large to run in one go. Trim it down — an exercise this size is usually a sign the exercise itself needs splitting.",
    };
  }

  try {
    const res = await fetch(
      `${auth.instanceUrl}/services/data/${API_VERSION}/tooling/executeAnonymous/?anonymousBody=${body}`,
      { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    );

    if (res.status === 401) {
      return {
        ok: false,
        message:
          "Your Salesforce org rejected the connection. Reconnecting it above should fix this.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `Salesforce refused the run (HTTP ${res.status}). This is on us or on the org, not on your code.`,
      };
    }

    return readAnonymousResult(await res.json());
  } catch (err) {
    // Network, DNS, a sleeping org. None of these are the learner's fault and
    // none of them are a pass.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[apex-runner] executeAnonymous failed:", err);
    return {
      ok: false,
      message: `We couldn't reach your Salesforce org just now — this is on us, not on your code. (${detail.slice(0, 200)})`,
    };
  }
}
