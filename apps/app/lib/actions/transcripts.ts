"use server";

import { db, type Prisma } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../session";
import { fetchVimeoCaptions } from "../vimeo";
import { parseVtt } from "../vtt";

export interface TranscriptActionResult {
  ok: boolean;
  message: string;
}

/** Pull captions from the lesson's Vimeo video and store as the transcript. */
export async function pullVimeoTranscript(
  lessonId: string,
  courseId: string,
): Promise<TranscriptActionResult> {
  await requireAdmin();
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, message: "Lesson not found." };
  if (lesson.videoProvider !== "VIMEO" || !lesson.videoId) {
    return { ok: false, message: "Lesson has no Vimeo video attached." };
  }

  const result = await fetchVimeoCaptions(lesson.videoId);
  if ("error" in result) return { ok: false, message: result.error };

  const parsed = parseVtt(result.vtt);
  const text = parsed.text;
  const segments = parsed.segments as unknown as Prisma.InputJsonValue;
  if (!text) {
    return { ok: false, message: "Caption file parsed to empty text." };
  }

  await db.transcript.upsert({
    where: { lessonId },
    create: {
      lessonId,
      text,
      segments,
      source: "CAPTIONS",
      language: result.language.slice(0, 5),
    },
    update: {
      text,
      segments,
      source: "CAPTIONS",
      language: result.language.slice(0, 5),
    },
  });

  revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
  return {
    ok: true,
    message: `Transcript stored: ${parsed.segments.length} segments, ${text.length} characters.`,
  };
}

/** Store a provided transcript: uploaded file (.vtt/.srt/.txt) or pasted text. */
export async function saveManualTranscript(
  lessonId: string,
  courseId: string,
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  let raw = "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    raw = (await file.text()).trim();
  }
  if (!raw) raw = String(formData.get("transcript") ?? "").trim();
  if (!raw) return;

  // SRT is close enough to VTT for our parser: "," ms separators and index
  // lines are tolerated, so both go through the timed-caption path.
  const isVtt = raw.startsWith("WEBVTT") || raw.includes("-->");
  const parsed = isVtt ? parseVtt(raw) : { text: raw, segments: null };
  const segments = parsed.segments
    ? (parsed.segments as unknown as Prisma.InputJsonValue)
    : undefined;

  await db.transcript.upsert({
    where: { lessonId },
    create: {
      lessonId,
      text: parsed.text,
      segments,
      source: "MANUAL",
    },
    update: {
      text: parsed.text,
      segments,
      source: "MANUAL",
    },
  });

  revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
}
