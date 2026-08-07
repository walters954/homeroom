import { defineTool } from "eve/tools";
import { z } from "zod";
import { db } from "@homeroom/db";

export default defineTool({
  description:
    "Fetch a lesson by id: title, body, video info, transcript, and its course/section context.",
  inputSchema: z.object({ lessonId: z.string() }),
  async execute({ lessonId }) {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        transcript: true,
        attachments: true,
        section: { include: { course: true } },
      },
    });
    if (!lesson) return { found: false as const };
    return {
      found: true as const,
      course: lesson.section.course.title,
      section: lesson.section.title,
      title: lesson.title,
      body: lesson.body,
      videoProvider: lesson.videoProvider,
      durationSeconds: lesson.durationSeconds,
      transcript: lesson.transcript?.text ?? null,
      transcriptSegments: lesson.transcript?.segments ?? null,
      attachments: lesson.attachments.map((a) => a.name),
    };
  },
});
