import Link from "next/link";
import { db } from "@homeroom/db";
import { createEvent } from "@/lib/actions/events";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/session";
import { Page } from "@/components/page-header";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db.event.findMany({
      where: { startsAt: { gte: now }, ...(user ? {} : { isPublic: true }) },
      orderBy: { startsAt: "asc" },
    }),
    db.event.findMany({
      where: { startsAt: { lt: now }, ...(user ? {} : { isPublic: true }) },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
  ]);

  const EventRow = ({ event }: { event: (typeof upcoming)[0] }) => (
    <Link
      href={`/events/${event.slug}`}
      className="block rounded-lg border border-line p-4 hover:border-dim"
    >
      <p className="font-medium">{event.title}</p>
      <p className="mt-1 text-sm text-dim">
        {event.startsAt.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </Link>
  );

  return (
    <Page width="narrow">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Events</h1>
      <section className="space-y-3">
        {upcoming.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
        {upcoming.length === 0 && (
          <EmptyState
            glyph="◉"
            title="Nothing scheduled"
            body={
              user?.role === "ADMIN"
                ? "Office hours are where the stuck get unstuck. Schedule one against whatever people are failing most — the recording becomes a lesson afterwards."
                : "No live sessions on the calendar right now. You'll be emailed when one is announced."
            }
          />
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dim">
            Past
          </h2>
          <div className="space-y-3 opacity-60">
            {past.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {user?.role === "ADMIN" && (
        <section className="mt-10 rounded-lg border border-line p-5">
          <h2 className="mb-3 text-lg font-semibold">New event</h2>
          <form action={createEvent} className="flex flex-col gap-3 text-sm">
            <input
              name="title"
              placeholder="Event title"
              required
              className="rounded-md border border-line px-3 py-2"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 font-medium">
                Starts
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="rounded-md border border-line px-3 py-2 font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 font-medium">
                Ends (optional)
                <input
                  name="endsAt"
                  type="datetime-local"
                  className="rounded-md border border-line px-3 py-2 font-normal"
                />
              </label>
            </div>
            <input
              name="joinUrl"
              placeholder="Join link (Zoom, Meet…)"
              className="rounded-md border border-line px-3 py-2"
            />
            <textarea
              name="body"
              rows={3}
              placeholder="Description (markdown — images, links)"
              className="rounded-md border border-line px-3 py-2"
            />
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="isPublic" defaultChecked />
              Public, shareable event page
            </label>
            <button className="self-start rounded-md bg-acc px-4 py-2 font-medium text-acc-ink hover:opacity-90">
              Create event
            </button>
          </form>
        </section>
      )}
    </Page>
  );
}
