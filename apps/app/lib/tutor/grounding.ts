import { db } from "@homeroom/db";

export interface GroundingSource {
  lessonId: string;
  course: string;
  section: string;
  lesson: string;
}

export interface GroundingContext {
  contextText: string;
  sources: GroundingSource[];
}

const CURRENT_LESSON_CHAR_CAP = 14000;
const EXCERPT_CHARS = 600;

/**
 * Build the tutor's grounding corpus for one question: the current lesson's
 * transcript + body first, then keyword-matched excerpts from the rest of the
 * transcript corpus. The tutor may only teach from what this returns.
 */
export async function buildGrounding(
  question: string,
  lessonId: string | null,
): Promise<GroundingContext> {
  const sources: GroundingSource[] = [];
  const parts: string[] = [];

  if (lessonId) {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        transcript: true,
        section: { include: { course: true } },
      },
    });
    if (lesson) {
      const source = {
        lessonId: lesson.id,
        course: lesson.section.course.title,
        section: lesson.section.title,
        lesson: lesson.title,
      };
      sources.push(source);
      const body = (lesson.body as { markdown?: string } | null)?.markdown;
      parts.push(
        `## Current lesson: "${lesson.title}" (${source.course} · ${source.section})\n` +
          (lesson.transcript
            ? `### Transcript\n${lesson.transcript.text.slice(0, CURRENT_LESSON_CHAR_CAP)}\n`
            : "(No transcript available for this lesson yet.)\n") +
          (body ? `### Lesson notes\n${body.slice(0, 4000)}\n` : ""),
      );
    }
  }

  // Keyword search across the rest of the corpus.
  const keywords = Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    ),
  ).slice(0, 6);

  if (keywords.length > 0) {
    const matches = await db.transcript.findMany({
      where: {
        lessonId: lessonId ? { not: lessonId } : undefined,
        OR: keywords.map((k) => ({
          text: { contains: k, mode: "insensitive" as const },
        })),
      },
      take: 4,
      include: {
        lesson: { include: { section: { include: { course: true } } } },
      },
    });

    for (const t of matches) {
      const idx = t.text
        .toLowerCase()
        .indexOf(keywords.find((k) => t.text.toLowerCase().includes(k)) ?? "");
      const start = Math.max(0, idx - 150);
      sources.push({
        lessonId: t.lessonId,
        course: t.lesson.section.course.title,
        section: t.lesson.section.title,
        lesson: t.lesson.title,
      });
      parts.push(
        `## Related lesson: "${t.lesson.title}" (${t.lesson.section.course.title} · ${t.lesson.section.title})\n` +
          `### Transcript excerpt\n…${t.text.slice(start, start + EXCERPT_CHARS)}…\n`,
      );
    }
  }

  return {
    contextText:
      parts.length > 0
        ? parts.join("\n")
        : "(No relevant course material found for this question.)",
    sources,
  };
}
