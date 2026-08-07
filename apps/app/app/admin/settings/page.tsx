import Link from "next/link";
import {
  updateAiModels,
  updateBranding,
  updateNotifications,
} from "@/lib/actions/settings";
import {
  getAiModels,
  getBranding,
  getNotificationSettings,
} from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { listSlackChannels, slackConnected } from "@/lib/slack";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Common Vercel AI Gateway model slugs — free-text field accepts any slug. */
const MODEL_OPTIONS = [
  "minimax/minimax-m2.7",
  "minimax/minimax-m2.7-highspeed",
  "minimax/minimax-m3",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5",
];

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [models, branding, notifications, channels] = await Promise.all([
    getAiModels(),
    getBranding(),
    getNotificationSettings(),
    slackConnected() ? listSlackChannels() : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-dim">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>
      </p>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Settings</h1>

      <section className="mb-8 rounded-lg border border-line p-5">
        <h2 className="mb-1 text-lg font-semibold">School branding</h2>
        <p className="mb-4 text-sm text-dim">
          What your students see — in the nav, browser tabs, the tutor&apos;s
          self-description, and calendar invites. They should never see the
          word &ldquo;Homeroom.&rdquo;
        </p>
        <form action={updateBranding} className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1 font-medium">
            School name
            <input
              name="schoolName"
              defaultValue={branding.schoolName}
              required
              placeholder="Revenue Engineer"
              className="rounded-md border border-line px-3 py-2 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Tagline
            <input
              name="tagline"
              defaultValue={branding.tagline}
              placeholder="Shown on the home page and as the site description"
              className="rounded-md border border-line px-3 py-2 font-normal"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 font-medium">
              Logo URL (optional)
              <input
                name="logoUrl"
                defaultValue={branding.logoUrl}
                placeholder="https://…/logo.svg"
                className="rounded-md border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Support email
              <input
                name="supportEmail"
                type="email"
                defaultValue={branding.supportEmail}
                placeholder="help@yourdomain.com"
                className="rounded-md border border-line px-3 py-2 font-normal"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 font-medium">
              Surface
              <select
                name="surface"
                defaultValue={branding.surface}
                className="rounded-md border border-line bg-bg px-3 py-2 font-normal"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Accent colour
              <span className="flex items-center gap-2">
                <input
                  name="accent"
                  defaultValue={branding.accent}
                  placeholder="#FF6B2B"
                  className="flex-1 rounded-md border border-line bg-bg px-3 py-2 font-mono text-xs font-normal"
                />
                <span
                  aria-hidden
                  className="h-8 w-8 shrink-0 rounded-md border border-line"
                  style={{ background: branding.accent }}
                />
              </span>
            </label>
          </div>
          <p className="text-xs text-dim">
            One hex is all we take. Hover, muted, and text-on-accent are derived
            from it, so a brand change can never make something unreadable.
          </p>
          <button className="self-start rounded-md bg-acc px-4 py-2 font-medium text-acc-ink hover:opacity-90">
            Save branding
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-line p-5">
        <h2 className="mb-1 text-lg font-semibold">AI models</h2>
        <p className="mb-4 text-sm text-dim">
          Any Vercel AI Gateway model slug works (provider/model). Simple
          handles the student tutor chat; Complex handles lesson drafts and
          announcement writing.
        </p>
        <form action={updateAiModels} className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1 font-medium">
            Simple tasks (tutor chat)
            <input
              name="simple"
              defaultValue={models.simple}
              list="model-options"
              required
              className="rounded-md border border-line px-3 py-2 font-mono text-xs"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Complex tasks (lesson drafts, announcements)
            <input
              name="complex"
              defaultValue={models.complex}
              list="model-options"
              required
              className="rounded-md border border-line px-3 py-2 font-mono text-xs"
            />
          </label>
          <datalist id="model-options">
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button className="self-start rounded-md bg-acc px-4 py-2 font-medium text-acc-ink hover:opacity-90">
            Save
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-line p-5">
        <h2 className="mb-1 text-lg font-semibold">Slack notifications</h2>
        <p className="mb-4 text-sm text-dim">
          {slackConnected()
            ? "Connected through Vercel Connect — no Slack secret is stored here. Pick the channel for new lessons, posts, events, and subscriptions."
            : "Not connected. Set SLACK_CONNECTOR_ID (Vercel Connect) or SLACK_WEBHOOK_URL to enable."}
        </p>
        {slackConnected() && (
          <form
            action={updateNotifications}
            className="flex flex-col gap-3 text-sm"
          >
            <label className="flex flex-col gap-1 font-medium">
              Channel
              <select
                name="slackChannel"
                defaultValue={notifications.slackChannel}
                className="rounded-md border border-line px-3 py-2 font-normal"
              >
                <option value="">— none (notifications off) —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-dim">
              Invite the app to a private channel first, or it can only post to
              public ones. Saving sends a test message.
            </p>
            <button className="self-start rounded-md bg-acc px-4 py-2 font-medium text-acc-ink hover:opacity-90">
              Save &amp; send test
            </button>
          </form>
        )}
      </section>

      <p className="mt-6 text-xs text-dim">
        Provider keys and spend live in the{" "}
        <a
          href="https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Vercel AI Gateway dashboard
        </a>
        . Changes here apply on the next request — no redeploy needed.
      </p>
    </main>
  );
}
