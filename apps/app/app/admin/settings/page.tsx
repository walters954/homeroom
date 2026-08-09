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
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { listSlackChannels, slackConnected } from "@/lib/slack";
import { Button, Card, Input, Select } from "@homeroom/ui";

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
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]}
        title="Settings"
        subtitle="School identity, branding, notifications and which model runs which task. Branding here re-themes the whole app."
      />

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-lg font-semibold">School branding</h2>
        <p className="mb-4 text-sm text-dim">
          What your students see — in the nav, browser tabs, the tutor&apos;s
          self-description, and calendar invites. They should never see the
          word &ldquo;Homeroom.&rdquo;
        </p>
        <form action={updateBranding} className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1 font-medium">
            School name
            <Input
              name="schoolName"
              defaultValue={branding.schoolName}
              required
              placeholder="Revenue Engineer"
              className="font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Tagline
            <Input
              name="tagline"
              defaultValue={branding.tagline}
              placeholder="Shown on the home page and as the site description"
              className="font-normal"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              Logo URL (optional)
              <Input
                name="logoUrl"
                defaultValue={branding.logoUrl}
                placeholder="https://…/logo.svg"
                className="font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Support email
              <Input
                name="supportEmail"
                type="email"
                defaultValue={branding.supportEmail}
                placeholder="help@yourdomain.com"
                className="font-normal"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              Surface
              <Select
                name="surface"
                defaultValue={branding.surface}
                className="font-normal"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Accent colour
              <span className="flex items-center gap-2">
                <Input
                  name="accent"
                  defaultValue={branding.accent}
                  placeholder="#FF6B2B"
                  className="flex-1 font-mono text-[12px] font-normal"
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
          <Button size="sm" className="self-start">
            Save branding
          </Button>
        </form>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-lg font-semibold">AI models</h2>
        <p className="mb-4 text-sm text-dim">
          Any Vercel AI Gateway model slug works (provider/model). Simple
          handles the student tutor chat; Complex handles lesson drafts and
          announcement writing.
        </p>
        <form action={updateAiModels} className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1 font-medium">
            Simple tasks (tutor chat)
            <Input
              name="simple"
              defaultValue={models.simple}
              list="model-options"
              required
              className="font-mono text-[12px] font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Complex tasks (lesson drafts, announcements)
            <Input
              name="complex"
              defaultValue={models.complex}
              list="model-options"
              required
              className="font-mono text-[12px] font-normal"
            />
          </label>
          <datalist id="model-options">
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Button size="sm" className="self-start">
            Save
          </Button>
        </form>
      </Card>

      <Card className="mt-4 p-5">
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
              <Select
                name="slackChannel"
                defaultValue={notifications.slackChannel}
                className="font-normal"
              >
                <option value="">— none (notifications off) —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </Select>
            </label>
            <p className="text-xs text-dim">
              Invite the app to a private channel first, or it can only post to
              public ones. Saving sends a test message.
            </p>
            <Button size="sm" className="self-start">
              Save &amp; send test
            </Button>
          </form>
        )}
      </Card>

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
    </Page>
  );
}
