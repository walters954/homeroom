import { getToken } from "@vercel/connect";

/**
 * Slack access via Vercel Connect: short-lived tokens minted from the
 * deployment's OIDC identity, so no Slack secret lives in env.
 */
const CONNECTOR = process.env.SLACK_CONNECTOR_ID;

export function slackConnected(): boolean {
  return Boolean(CONNECTOR);
}

async function slackToken(scopes: string[]): Promise<string | null> {
  if (!CONNECTOR) return null;
  try {
    return await getToken(CONNECTOR, { subject: { type: "app" }, scopes });
  } catch {
    return null;
  }
}

export interface SlackChannel {
  id: string;
  name: string;
}

export async function listSlackChannels(): Promise<SlackChannel[]> {
  const token = await slackToken(["channels:read", "groups:read"]);
  if (!token) return [];
  try {
    const res = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true",
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const data = (await res.json()) as {
      ok: boolean;
      channels?: { id: string; name: string }[];
    };
    if (!data.ok || !data.channels) return [];
    return data.channels
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Post to a channel. Returns false if not configured or the call failed. */
export async function postSlackMessage(
  channel: string,
  text: string,
): Promise<boolean> {
  const token = await slackToken(["chat:write"]);
  if (!token) return false;
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text, unfurl_links: false }),
    });
    const data = (await res.json()) as { ok: boolean };
    return data.ok;
  } catch {
    return false;
  }
}
