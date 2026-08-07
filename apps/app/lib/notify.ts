/**
 * Outbound notification helpers. Each one silently no-ops when its
 * integration isn't configured, so features degrade gracefully.
 */

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Slack incoming-webhook notification (SLACK_WEBHOOK_URL). */
export async function postToSlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
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
