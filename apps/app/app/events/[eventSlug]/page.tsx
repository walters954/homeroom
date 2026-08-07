import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { deleteEvent, rsvp } from "@/lib/actions/events";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}): Promise<Metadata> {
  const { eventSlug } = await params;
  const event = await db.event.findUnique({ where: { slug: eventSlug } });
  if (!event?.isPublic) return {};
  return {
    title: event.title,
    description: `${event.startsAt.toUTCString()}`,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const [user, event] = await Promise.all([
    getCurrentUser(),
    db.event.findUnique({
      where: { slug: eventSlug },
      include: {
        rsvps: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  if (!event) notFound();
  if (!event.isPublic && !user) redirect("/sign-in");

  const path = `/events/${event.slug}`;
  const going = event.rsvps.filter((r) => r.status === "GOING");
  const mine = user ? event.rsvps.find((r) => r.user.id === user.id) : null;
  const markdown = (event.body as { markdown?: string } | null)?.markdown;
  const soon =
    event.startsAt.getTime() - Date.now() < 1000 * 60 * 60 && event.joinUrl;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-zinc-500">
        <Link href="/events" className="hover:underline">
          Events
        </Link>
      </p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">{event.title}</h1>
      <p className="mb-6 text-zinc-500">
        {event.startsAt.toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })}
        {" · "}
        <a href={`${path}/ics`} className="underline">
          add to calendar
        </a>
      </p>

      {markdown && (
        <div className="mb-8">
          <Markdown>{markdown}</Markdown>
        </div>
      )}

      {user && soon && (
        <a
          href={event.joinUrl!}
          target="_blank"
          rel="noreferrer"
          className="mb-6 inline-block rounded-md bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500"
        >
          Join now →
        </a>
      )}

      {user ? (
        <div className="flex items-center gap-2">
          {(["GOING", "MAYBE", "NOT_GOING"] as const).map((status) => (
            <form key={status} action={rsvp.bind(null, event.id, path)}>
              <input type="hidden" name="status" value={status} />
              <button
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  mine?.status === status
                    ? "bg-zinc-900 text-white"
                    : "border border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                {status === "GOING"
                  ? "Going"
                  : status === "MAYBE"
                    ? "Maybe"
                    : "Can't go"}
              </button>
            </form>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
          <Link href="/sign-up" className="font-medium underline">
            Create an account
          </Link>{" "}
          to RSVP and get the join link.
        </p>
      )}

      {going.length > 0 && (
        <p className="mt-6 text-sm text-zinc-500">
          {going.length} going: {going.map((r) => r.user.name).join(", ")}
        </p>
      )}

      {user?.role === "ADMIN" && (
        <form action={deleteEvent.bind(null, event.id)} className="mt-10">
          <button className="text-sm text-red-500 hover:underline">
            Delete event
          </button>
        </form>
      )}
    </main>
  );
}
