"use server";

import { db, type Prisma } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { defaultModel, makeAnthropic } from "../ai";
import { APP_URL, postToSlack, sendEmail } from "../notify";
import { requireAdmin } from "../session";

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

async function askClaude(prompt: string): Promise<string> {
  const client = makeAnthropic();
  const response = await client.messages.create({
    model: defaultModel(),
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Content ops: draft lesson body + SEO from the transcript → suggestion queue. */
export async function draftLessonFromTranscript(
  lessonId: string,
  courseId: string,
) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { transcript: true, section: { include: { course: true } } },
  });
  if (!lesson?.transcript) return;

  const text = await askClaude(
    `You are the teaching agent for an online school. Below is the transcript of the video for the lesson "${lesson.title}" (course: ${lesson.section.course.title}).

Draft, in the instructor's own voice (match the transcript's tone — do not formalize casual explanations):
1. A lesson body in markdown: short intro, one section per core teaching point in taught order, key takeaways at the end.
2. An SEO title under 60 characters and SEO description under 155 characters describing what the lesson actually teaches.

Use ONLY what the transcript contains — never invent content the instructor didn't teach.

Return ONLY a JSON object: {"bodyMarkdown": "...", "seoTitle": "...", "seoDescription": "..."}

TRANSCRIPT:
${lesson.transcript.text.slice(0, 60000)}`,
  );

  const parsed = extractJson<{
    bodyMarkdown: string;
    seoTitle: string;
    seoDescription: string;
  }>(text);

  const draft = parsed ?? {
    bodyMarkdown: text,
    seoTitle: null,
    seoDescription: null,
  };
  await db.agentSuggestion.create({
    data: {
      type: "LESSON_DRAFT",
      payload: { lessonId, ...draft } as Prisma.InputJsonValue,
      evidence: {
        lessonId,
        lessonTitle: lesson.title,
        transcriptSource: lesson.transcript.source,
        transcriptChars: lesson.transcript.text.length,
        transcriptExcerpt: lesson.transcript.text.slice(0, 300),
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/suggestions");
  revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
}

/** Engagement: draft a new-content announcement email → suggestion queue. */
export async function draftAnnouncement(lessonId: string, courseId: string) {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { transcript: true, section: { include: { course: true } } },
  });
  if (!lesson) return;

  const text = await askClaude(
    `You are the teaching agent for an online school. A new lesson just shipped: "${lesson.title}" in the course "${lesson.section.course.title}".

Draft a short announcement email to members (3 short paragraphs max, warm and direct, instructor's voice). Say what the lesson covers and why it's worth watching, based ONLY on the summary below. End by linking to the lesson with this exact URL: ${APP_URL}/courses/${lesson.section.course.slug}/${lesson.slug}

Return ONLY a JSON object: {"subject": "...", "bodyHtml": "<p>...</p>"}

LESSON SUMMARY:
${lesson.transcript ? lesson.transcript.text.slice(0, 8000) : ((lesson.body as { markdown?: string } | null)?.markdown ?? lesson.title)}`,
  );

  const parsed = extractJson<{ subject: string; bodyHtml: string }>(text);
  if (!parsed) return;

  await db.agentSuggestion.create({
    data: {
      type: "ANNOUNCEMENT",
      payload: { lessonId, ...parsed } as Prisma.InputJsonValue,
      evidence: {
        lessonId,
        lessonTitle: lesson.title,
        groundedOn: lesson.transcript ? "transcript" : "lesson body",
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/admin/suggestions");
  revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
}

/** Approve: strong evidence acts — apply the suggestion for real. */
export async function approveSuggestion(suggestionId: string) {
  await requireAdmin();
  const suggestion = await db.agentSuggestion.findUnique({
    where: { id: suggestionId },
  });
  if (!suggestion || suggestion.status !== "PENDING") return;

  if (suggestion.type === "LESSON_DRAFT") {
    const p = suggestion.payload as {
      lessonId: string;
      bodyMarkdown: string;
      seoTitle?: string | null;
      seoDescription?: string | null;
    };
    await db.lesson.update({
      where: { id: p.lessonId },
      data: {
        body: { markdown: p.bodyMarkdown },
        seoTitle: p.seoTitle ?? undefined,
        seoDescription: p.seoDescription ?? undefined,
      },
    });
  } else if (suggestion.type === "ANNOUNCEMENT") {
    const p = suggestion.payload as { subject: string; bodyHtml: string };
    const members = await db.user.findMany({ select: { email: true } });
    for (const m of members) {
      await sendEmail(m.email, p.subject, p.bodyHtml);
    }
    await postToSlack(`📣 Announcement sent to ${members.length} members: ${p.subject}`);
  } else if (suggestion.type === "NUDGE_EMAIL") {
    const p = suggestion.payload as {
      email: string;
      subject: string;
      bodyHtml: string;
    };
    await sendEmail(p.email, p.subject, p.bodyHtml);
  }

  await db.agentSuggestion.update({
    where: { id: suggestionId },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });
  revalidatePath("/admin/suggestions");
}

export async function rejectSuggestion(suggestionId: string) {
  await requireAdmin();
  await db.agentSuggestion.update({
    where: { id: suggestionId },
    data: { status: "REJECTED", resolvedAt: new Date() },
  });
  revalidatePath("/admin/suggestions");
}
