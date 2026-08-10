/**
 * Apex, executed in the Salesforce org the learner connected (#29).
 *
 * The only runner so far that needs credentials belonging to the learner
 * rather than to the deployment, which is why `isConfigured` takes the
 * request: whether Apex can run is a question about *this* person, not about
 * the school. It is also the reason this package owns the OAuth flow, the
 * token encryption and the org guardrail rather than the app.
 *
 * Nothing is deployed to the org — one anonymous block, with its DML rolled
 * back when it finishes.
 */

import type { LanguageRunner, RunOutcome, RunRequest } from "@homeroom/exercise-runner";
import { NO_ORG_MESSAGE, runApexInLearnerOrg } from "./apex-run";
import { getConnection, isSalesforceConfigured } from "./connect";

export const apexRunner: LanguageRunner = {
  name: "apex",
  languages: ["APEX"],
  async isConfigured({ userId }: RunRequest) {
    if (!isSalesforceConfigured()) return false;
    return Boolean(await getConnection(userId));
  },
  notConfiguredMessage: NO_ORG_MESSAGE,
  run({ files, testFiles, userId }: RunRequest): Promise<RunOutcome> {
    return runApexInLearnerOrg(userId, files, testFiles);
  },
};

// The setup surface the app mounts: OAuth endpoints, connection state, and the
// guardrail copy. A language that needs the learner to bring something owns the
// words for it.
export {
  API_VERSION,
  accessTokenFor,
  authorizeUrl,
  createPkce,
  createState,
  disconnectOrg,
  exchangeCode,
  fetchOrgIdentity,
  getConnection,
  isSalesforceConfigured,
  saveConnection,
  verdictFor,
} from "./connect";
export { ORG_DOCS, orgVerdict } from "./org";
export type { OrgFacts, OrgVerdict } from "./org";
export { NO_ORG_MESSAGE } from "./apex-run";
