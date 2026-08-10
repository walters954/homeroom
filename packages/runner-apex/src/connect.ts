/**
 * Connecting a learner's own Salesforce org (issue #29).
 *
 * OAuth is done against the documented endpoints with `fetch` rather than
 * through a client library: the flow is four parameters and one POST, and
 * owning it here means PKCE and refresh-token rotation are visible in the code
 * rather than depending on a library's spelling of them. Both are mandatory on
 * connected apps and external client apps as of 11 May 2026 — and since
 * connected app *creation* is restricted from Spring '26, the app this talks to
 * should be an **External Client App**.
 *
 * Unconfigured deployments degrade rather than crash, per lib/notify.ts: no
 * client id, or no key to encrypt the refresh token with, and Apex exercises
 * keep reporting honestly that they cannot run.
 */

import { createHash, randomBytes } from "node:crypto";
import { db } from "@homeroom/db";
import { decryptToken, encryptToken, isEncryptionConfigured } from "./crypto";
import { orgVerdict, type OrgFacts, type OrgVerdict } from "./org";

export const API_VERSION = "v62.0";

/** Playgrounds and Developer Edition orgs both authenticate here. */
const PRODUCTION_LOGIN = "https://login.salesforce.com";
const SANDBOX_LOGIN = "https://test.salesforce.com";

/** `api` to run Apex, `refresh_token` so a learner connects once. */
const SCOPES = "api refresh_token";

export function isSalesforceConfigured(): boolean {
  return Boolean(
    process.env.SALESFORCE_CLIENT_ID &&
      process.env.SALESFORCE_CLIENT_SECRET &&
      isEncryptionConfigured(),
  );
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/salesforce/callback`;
}

function tokenKey(): string {
  return process.env.SALESFORCE_TOKEN_KEY ?? "";
}

export interface Pkce {
  verifier: string;
  challenge: string;
}

export function createPkce(): Pkce {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createState(): string {
  return randomBytes(24).toString("base64url");
}

export function authorizeUrl(challenge: string, state: string, sandbox: boolean): string {
  const login = sandbox ? SANDBOX_LOGIN : PRODUCTION_LOGIN;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SALESFORCE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${login}/services/oauth2/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  id: string;
}

export async function exchangeCode(
  code: string,
  verifier: string,
  sandbox: boolean,
): Promise<TokenResponse | null> {
  const login = sandbox ? SANDBOX_LOGIN : PRODUCTION_LOGIN;
  const res = await fetch(`${login}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.SALESFORCE_CLIENT_ID ?? "",
      client_secret: process.env.SALESFORCE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as TokenResponse;
}

/**
 * Mint a fresh access token. With refresh-token rotation on, the response may
 * carry a replacement — storing it is what keeps the connection alive, since
 * the old one stops working the moment this succeeds.
 */
export async function accessTokenFor(
  userId: string,
): Promise<{ accessToken: string; instanceUrl: string } | null> {
  const connection = await db.salesforceConnection.findUnique({ where: { userId } });
  if (!connection) return null;

  const refreshToken = decryptToken(connection.refreshToken, tokenKey());
  if (!refreshToken) return null;

  const login = connection.isSandbox ? SANDBOX_LOGIN : PRODUCTION_LOGIN;
  const res = await fetch(`${login}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.SALESFORCE_CLIENT_ID ?? "",
      client_secret: process.env.SALESFORCE_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) return null;

  const token = (await res.json()) as Partial<TokenResponse>;
  if (!token.access_token) return null;

  if (token.refresh_token && token.refresh_token !== refreshToken) {
    await db.salesforceConnection.update({
      where: { userId },
      data: { refreshToken: encryptToken(token.refresh_token, tokenKey()) },
    });
  }

  return {
    accessToken: token.access_token,
    instanceUrl: token.instance_url ?? connection.instanceUrl,
  };
}

export interface OrgIdentity extends OrgFacts {
  orgId: string;
  username: string;
}

/** What kind of org this is, asked of the org rather than assumed. */
export async function fetchOrgIdentity(
  instanceUrl: string,
  accessToken: string,
  identityUrl: string,
): Promise<OrgIdentity | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const soql =
    "SELECT Id, OrganizationType, IsSandbox, TrialExpirationDate FROM Organization LIMIT 1";
  const [orgRes, meRes] = await Promise.all([
    fetch(`${instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`, {
      headers,
    }),
    fetch(identityUrl, { headers }),
  ]);
  if (!orgRes.ok || !meRes.ok) return null;

  const org = (await orgRes.json()) as {
    records?: {
      Id?: string;
      OrganizationType?: string;
      IsSandbox?: boolean;
      TrialExpirationDate?: string | null;
    }[];
  };
  const record = org.records?.[0];
  if (!record?.Id) return null;

  const me = (await meRes.json()) as { username?: string };

  return {
    orgId: record.Id,
    username: me.username ?? "unknown",
    organizationType: record.OrganizationType ?? "",
    isSandbox: record.IsSandbox === true,
    trialExpirationDate: record.TrialExpirationDate ?? null,
  };
}

export function verdictFor(identity: OrgIdentity): OrgVerdict {
  return orgVerdict(identity);
}

export async function saveConnection(
  userId: string,
  identity: OrgIdentity,
  instanceUrl: string,
  refreshToken: string,
): Promise<void> {
  const data = {
    orgId: identity.orgId,
    instanceUrl,
    username: identity.username,
    orgType: identity.organizationType,
    isSandbox: identity.isSandbox,
    refreshToken: encryptToken(refreshToken, tokenKey()),
  };
  await db.salesforceConnection.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function getConnection(userId: string) {
  return db.salesforceConnection.findUnique({
    where: { userId },
    select: {
      instanceUrl: true,
      username: true,
      orgType: true,
      isSandbox: true,
      connectedAt: true,
    },
  });
}

export async function disconnectOrg(userId: string): Promise<void> {
  await db.salesforceConnection.deleteMany({ where: { userId } });
}
