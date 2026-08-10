/**
 * Which orgs a learner is allowed to connect (issue #29).
 *
 * Exercises run anonymous Apex in the org the learner brings. That code does
 * real DML — rolled back with a savepoint, but rolled back by us, in their org.
 * Betting a company's production data on our `finally` block is not a bet to
 * offer, so production is refused rather than warned about. Someone will
 * otherwise connect their employer's org to a training exercise, once.
 *
 * No imports, so `org.test.mjs` can load it directly.
 */

export interface OrgFacts {
  /** `Organization.OrganizationType` — "Developer Edition", "Enterprise Edition", … */
  organizationType: string;
  isSandbox: boolean;
  /** Set on trial and scratch orgs; null on a durable org. */
  trialExpirationDate?: string | null;
}

export type OrgVerdict =
  | { allowed: true; kind: "developer" | "sandbox" | "scratch" }
  | { allowed: false; reason: string };

/** Free, disposable, and what the docs tell a learner to create. */
const DEVELOPER_TYPES = new Set([
  "Developer Edition",
  "Trailhead Playground",
]);

export function orgVerdict(facts: OrgFacts): OrgVerdict {
  const type = facts.organizationType?.trim() ?? "";

  // A scratch org reports as Developer Edition with an expiry; either way it is
  // disposable, which is the property that matters here.
  if (DEVELOPER_TYPES.has(type)) {
    return { allowed: true, kind: facts.trialExpirationDate ? "scratch" : "developer" };
  }

  if (facts.isSandbox) return { allowed: true, kind: "sandbox" };

  if (!type) {
    return {
      allowed: false,
      reason:
        "We couldn't tell what kind of org this is, so we haven't connected it. Exercises run real Apex, and that isn't something to guess about.",
    };
  }

  return {
    allowed: false,
    reason:
      `This looks like a production org (${type}). Exercises run real Apex against whatever you connect, ` +
      "so Homeroom only accepts a Developer Edition org, a Trailhead Playground or a sandbox. " +
      "Creating a playground takes about two minutes.",
  };
}

/** Where a learner goes to get an org that will be accepted. */
export const ORG_DOCS = [
  {
    label: "Trailhead Playground",
    href: "https://trailhead.salesforce.com/en/help?article=Trailhead-Playground-Management",
    note: "Fastest if you already have a Trailhead account — you may have one already.",
  },
  {
    label: "Developer Edition org",
    href: "https://developer.salesforce.com/signup",
    note: "Free, permanent, and yours. Takes about two minutes plus an email confirmation.",
  },
] as const;
