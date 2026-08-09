import { db, type User } from "@homeroom/db";
import type { AgentScope } from "@/lib/agent/scope";
import { parseTestResults } from "@/lib/exercises/runner";
import { getPracticeSnapshot, isAttempt, STATUS_LABEL } from "@/lib/practice";
import {
  exerciseContext,
  progressContext,
  threadContext,
  type ContextFile,
} from "./context";

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

const CURRENT_LESSON_CHAR_CAP = 60000;
const EXCERPT_CHARS = 600;

/** `[{ path, contents }]` columns, which Prisma hands back as `Json`. */
function contextFiles(value: unknown): ContextFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((f) => {
    if (!f || typeof f !== "object") return [];
    const { path, contents } = f as Record<string, unknown>;
    return typeof path === "string" && typeof contents === "string"
      ? [{ path, contents }]
      : [];
  });
}

function testSpec(value: unknown): { name: string; description?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const { name, description } = s as Record<string, unknown>;
    if (typeof name !== "string") return [];
    return [
      { name, description: typeof description === "string" ? description : undefined },
    ];
  });
}

/**
 * The exercise, the learner's own attempts, and how the runs went.
 *
 * `select` is doing real work here: `testFiles` and `solutionFiles` live on the
 * same row and are never read, so the answer key cannot reach the model even by
 * accident. `context.test.mjs` holds that line.
 */
async function exerciseScopeContext(
  exerciseId: string,
  user: User,
): Promise<{ text: string; lessonId: string | null } | null> {
  const exercise = await db.exercise.findUnique({
    where: { id: exerciseId },
    select: {
      title: true,
      prompt: true,
      language: true,
      lessonId: true,
      starterFiles: true,
      testSpec: true,
    },
  });
  if (!exercise) return null;

  const submissions = await db.submission.findMany({
    where: { userId: user.id, exerciseId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const attemptCount = await db.submission.count({
    where: { userId: user.id, exerciseId },
  });
  const latest = submissions[0] ?? null;

  return {
    lessonId: exercise.lessonId,
    text: exerciseContext({
      title: exercise.title,
      prompt: exercise.prompt,
      language: exercise.language,
      starterFiles: contextFiles(exercise.starterFiles),
      testSpec: testSpec(exercise.testSpec),
      attemptCount,
      latest: latest && {
        files: contextFiles(latest.files),
        passed: latest.passed,
        results: parseTestResults(latest.testResults),
        hintsUsed: latest.hintsUsed,
        at: latest.createdAt,
      },
    }),
  };
}

const REPEAT_THRESHOLD = 2;

/** What they've proven, what's due, and the checks they keep failing. */
async function progressScopeContext(user: User): Promise<string> {
  const snapshot = await getPracticeSnapshot(user);

  const submissions = await db.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { exercise: { include: { skill: true } } },
  });

  // A check that fails once is a bad afternoon; the same check failing across
  // attempts is the error pattern worth naming.
  const counts = new Map<
    string,
    { exercise: string; skill: string; check: string; times: number }
  >();
  for (const submission of submissions) {
    if (!isAttempt(submission)) continue;
    for (const result of parseTestResults(submission.testResults)) {
      if (result.passed) continue;
      const key = `${submission.exerciseId}:${result.name}`;
      const seen = counts.get(key);
      if (seen) seen.times += 1;
      else
        counts.set(key, {
          exercise: submission.exercise.title,
          skill: submission.exercise.skill.name,
          check: result.name,
          times: 1,
        });
    }
  }

  const proposed = snapshot.ranked[0] ?? null;

  const courses = await db.course.findMany({
    where: { id: { in: [...new Set(snapshot.skills.map((s) => s.skill.courseId))] } },
    select: { id: true, title: true },
  });
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));

  return progressContext({
    skills: snapshot.skills.map(({ skill, state, status }) => ({
      name: skill.name,
      course: courseTitle.get(skill.courseId) ?? "",
      status: STATUS_LABEL[status],
      attemptCount: state?.attemptCount ?? 0,
    })),
    dueRecall: snapshot.dueRecall,
    repeatedFailures: [...counts.values()]
      .filter((f) => f.times >= REPEAT_THRESHOLD)
      .sort((a, b) => b.times - a.times)
      .slice(0, 6),
    proposed: proposed && { title: proposed.title, reason: proposed.reason },
  });
}

function markdownOf(body: unknown): string {
  return (body as { markdown?: string } | null)?.markdown ?? "";
}

/** The post and its replies. */
async function threadScopeContext(postId: string): Promise<string | null> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: {
      space: { select: { name: true } },
      author: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!post) return null;

  return threadContext({
    space: post.space.name,
    title: post.title,
    author: post.author.name,
    body: markdownOf(post.body),
    comments: post.comments.map((c) => ({
      author: c.author.name,
      body: markdownOf(c.body),
      at: c.createdAt,
    })),
  });
}

/**
 * Build the tutor's grounding corpus for one question: what the scope is about,
 * then the anchor lesson's transcript + body, then keyword-matched excerpts
 * from the rest of the transcript corpus. The tutor may only teach from what
 * this returns.
 */
export async function buildGrounding(
  question: string,
  scope: AgentScope,
  user: User,
): Promise<GroundingContext> {
  const sources: GroundingSource[] = [];
  const parts: string[] = [];

  // An exercise anchors on the lesson it came from, so the concept is in the
  // corpus alongside the attempt.
  let lessonId: string | null = null;
  switch (scope.kind) {
    case "lesson":
      lessonId = scope.lessonId;
      break;
    case "exercise": {
      const exercise = await exerciseScopeContext(scope.exerciseId, user);
      if (exercise) {
        parts.push(exercise.text);
        lessonId = exercise.lessonId;
      }
      break;
    }
    case "progress":
      parts.push(await progressScopeContext(user));
      break;
    case "thread": {
      const thread = await threadScopeContext(scope.postId);
      if (thread) parts.push(thread);
      break;
    }
  }

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
