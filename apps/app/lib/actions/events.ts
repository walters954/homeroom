"use server";

import { db, type RsvpStatus } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_URL, postToSlack } from "../notify";
import { requireAdmin, requireUser } from "../session";
import { slugify } from "../slug";

export async function createEvent(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  if (!title || !startsAtRaw) return;
  const endsAtRaw = String(formData.get("endsAt") ?? "");
  const markdown = String(formData.get("body") ?? "").trim();

  const event = await db.event.create({
    data: {
      title,
      slug: slugify(title) || `event-${Date.now()}`,
      startsAt: new Date(startsAtRaw),
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      joinUrl: String(formData.get("joinUrl") ?? "").trim() || null,
      body: markdown ? { markdown } : undefined,
      coverImageUrl:
        String(formData.get("coverImageUrl") ?? "").trim() || null,
      isPublic: formData.get("isPublic") === "on",
    },
  });

  await postToSlack(
    `📅 New event: *${event.title}* — ${event.startsAt.toUTCString()}\n${APP_URL}/events/${event.slug}`,
  );

  revalidatePath("/events");
  redirect(`/events/${event.slug}`);
}

export async function rsvp(eventId: string, path: string, formData: FormData) {
  const user = await requireUser();
  const status = String(formData.get("status") ?? "GOING") as RsvpStatus;
  await db.eventRsvp.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status },
    update: { status },
  });
  revalidatePath(path);
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  await db.event.delete({ where: { id: eventId } });
  revalidatePath("/events");
  redirect("/events");
}
