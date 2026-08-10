import * as Sentry from "@sentry/nextjs";
import { db } from "@homeroom/db";
import { APP_URL, sendEmail } from "@/lib/notify";

export const maxDuration = 300;

/** Hourly cron: email GOING members ~24h before an event starts. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      // Not a job failure — no check-in, so a probe can't mark the cron red.
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // The check-in tells Sentry the job ran; the schedule tells it when to
  // complain if one doesn't. A cron that stops firing produces no error at
  // all, which is why nothing else in this file would ever catch it.
  return Sentry.withMonitor("cron-event-reminders", run, {
    schedule: { type: "crontab", value: "0 * * * *" },
    checkinMargin: 10,
    maxRuntime: 10,
  });
}

async function run(): Promise<Response> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await db.event.findMany({
    where: { startsAt: { gte: now, lte: cutoff }, remindedAt: null },
    include: {
      rsvps: {
        where: { status: "GOING" },
        include: { user: { select: { email: true, name: true } } },
      },
    },
  });

  let sent = 0;
  for (const event of events) {
    const when = event.startsAt.toLocaleString("en-US", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    for (const r of event.rsvps) {
      await sendEmail(
        r.user.email,
        `Reminder: ${event.title} is coming up`,
        `<p>Hi ${r.user.name},</p><p><strong>${event.title}</strong> starts ${when}.</p><p><a href="${APP_URL}/events/${event.slug}">Event page & join link</a></p>`,
      );
      sent++;
    }
    await db.event.update({
      where: { id: event.id },
      data: { remindedAt: now },
    });
  }

  return Response.json({ events: events.length, emailsSent: sent });
}
