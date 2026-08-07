/**
 * Outbound notification helpers. Each one silently no-ops when its
 * integration isn't configured, so features degrade gracefully.
 */

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Slack notification. Prefers Vercel Connect (no stored secret, channel
 * chosen in admin settings); falls back to a classic incoming webhook.
 */
export async function postToSlack(text: string): Promise<void> {
  try {
    const { slackConnected, postSlackMessage } = await import("./slack");
    if (slackConnected()) {
      const { getNotificationSettings } = await import("./settings");
      const { slackChannel } = await getNotificationSettings();
      if (slackChannel) {
        await postSlackMessage(slackChannel, text);
        return;
      }
    }
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Notifications never break the main flow.
  }
}

/** Transactional email via Resend (RESEND_API_KEY, EMAIL_FROM). */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
        to,
        subject,
        html,
      }),
    });
  } catch {
    // ignore
  }
}

/** Sync a new member into Kit (ConvertKit) — marketing stays in Kit. */
export async function kitSubscribe(
  email: string,
  firstName?: string,
): Promise<void> {
  const key = process.env.KIT_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.kit.com/v4/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kit-Api-Key": key,
      },
      body: JSON.stringify({ email_address: email, first_name: firstName }),
    });
  } catch {
    // ignore
  }
}
