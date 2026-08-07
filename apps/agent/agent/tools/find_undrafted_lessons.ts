import { defineTool } from "eve/tools";
import { z } from "zod";
import { db } from "@homeroom/db";

export default defineTool({
  description:
    "Find lessons that have a transcript but no written body yet, and that don't already have a pending draft waiting for review. This is the agent's work queue for content ops.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(20).default(5),
  }),
  async execute({ limit }) {
    const pending = await db.agentSuggestion.findMany({
      where: { type: "LESSON_DRAFT", status: "PENDING" },
      select: { payload: true },
    });
    const alreadyQueued = new Set(
      pending
        .map((s) => (s.payload as { lessonId?: string }).lessonId)
        .filter(Boolean) as string[],
    );

    const candidates = await db.lesson.findMany({
      where: {
        transcript: { isNot: null },
        id: { notIn: [...alreadyQueued] },
      },
      take: limit * 3,
      orderBy: { createdAt: "asc" },
      include: {
        transcript: { select: { text: true, source: true } },
        section: { include: { course: { select: { title: true } } } },
      },
    });

    // "No body yet" means missing or trivially short markdown.
    const undrafted = candidates
      .filter((l) => {
        const markdown = (l.body as { markdown?: string } | null)?.markdown;
        return !markdown || markdown.trim().length < 200;
      })
      .slice(0, limit);

    return {
      count: undrafted.length,
      lessons: undrafted.map((l) => ({
        lessonId: l.id,
        title: l.title,
        course: l.section.course.title,
        section: l.section.title,
        transcriptChars: l.transcript?.text.length ?? 0,
        transcriptSource: l.transcript?.source,
      })),
    };
  },
});
