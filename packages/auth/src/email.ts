/**
 * Minimal Resend sender for auth emails. Kept here (rather than importing the
 * app's notify helpers) so packages/auth has no dependency on the Next app.
 */
export async function sendAuthEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[auth] RESEND_API_KEY unset — email to ${to} not sent.`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
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
  if (!res.ok) {
    console.error(`[auth] Resend error ${res.status}: ${await res.text()}`);
  }
}

export function emailLayout(heading: string, body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#18181b">
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  ${body}
  <p style="color:#a1a1aa;font-size:12px;margin-top:32px">If you weren't expecting this email, you can safely ignore it.</p>
</div>`;
}

export function buttonHtml(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${url}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:500">${label}</a></p>
  <p style="color:#71717a;font-size:13px">Or paste this link into your browser:<br><a href="${url}" style="color:#71717a">${url}</a></p>`;
}
