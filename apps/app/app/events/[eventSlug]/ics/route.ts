import { db } from "@homeroom/db";
import { getBranding } from "@/lib/settings";

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await params;
  const event = await db.event.findUnique({ where: { slug: eventSlug } });
  if (!event) return new Response("Not found", { status: 404 });

  const end =
    event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${(await getBranding()).schoolName}//EN`,
    "BEGIN:VEVENT",
    `UID:${event.id}@homeroom`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${event.title.replace(/[,;]/g, " ")}`,
    event.joinUrl ? `URL:${event.joinUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
