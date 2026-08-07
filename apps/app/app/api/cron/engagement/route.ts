import { db, type Prisma } from "@homeroom/db";
import { APP_URL } from "@/lib/notify";

const INACTIVE_DAYS = 14;

/**
 * Weekly cron: the agent watches progress and files pace-tracking nudge
 * suggestions (weak evidence suggests — nothing sends without approval).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const members = await db.user.findMany({
    where: { role: "MEMBER" },
    include: {
      lessonProgress: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  let filed = 0;
  for (const member of members) {
    const last = member.lessonProgress[0];
    const lastActive = last?.updatedAt ?? member.createdAt;
    if (lastActive > cutoff) continue;

    // One pending nudge per member at a time.
    const pending = await db.agentSuggestion.findFirst({
      where: {
        type: "NUDGE_EMAIL",
        status: "PENDING",
        payload: { path: ["email"], equals: member.email },
      },
    });
    if (pending) continue;

    await db.agentSuggestion.create({
      data: {
        type: "NUDGE_EMAIL",
        payload: {
          email: member.email,
          subject: "Pick up where you left off",
          bodyHtml: `<p>Hi ${member.name.split(" ")[0]},</p><p>It's been a couple of weeks since your last lesson — your progress is saved right where you left it.</p><p><a href="${APP_URL}/courses">Jump back in →</a></p>`,
        } as Prisma.InputJsonValue,
        evidence: {
          memberId: member.id,
          lastActiveAt: lastActive.toISOString(),
          inactiveDays: Math.floor(
            (Date.now() - lastActive.getTime()) / (24 * 60 * 60 * 1000),
          ),
        } as Prisma.InputJsonValue,
      },
    });
    filed++;
  }

  return Response.json({ membersChecked: members.length, nudgesFiled: filed });
}
