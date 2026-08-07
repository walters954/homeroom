import { defineTool } from "eve/tools";
import { z } from "zod";
import { db } from "@homeroom/db";

export default defineTool({
  description:
    "Full-text search across all lesson transcripts. Returns matching lessons with excerpt context. Use this to ground every tutoring answer.",
  inputSchema: z.object({
    query: z.string().min(2),
    limit: z.number().int().min(1).max(20).default(5),
  }),
  async execute({ query, limit }) {
    // v1: naive ILIKE search; upgrade path is Postgres FTS / pgvector.
    const transcripts = await db.transcript.findMany({
      where: { text: { contains: query, mode: "insensitive" } },
      take: limit,
      include: {
        lesson: { include: { section: { include: { course: true } } } },
      },
    });
    return transcripts.map((t) => {
      const idx = t.text.toLowerCase().indexOf(query.toLowerCase());
      const start = Math.max(0, idx - 200);
      return {
        lessonId: t.lessonId,
        course: t.lesson.section.course.title,
        section: t.lesson.section.title,
        lesson: t.lesson.title,
        excerpt: t.text.slice(start, start + 500),
      };
    });
  },
});
