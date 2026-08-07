"use server";

import { db } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "../session";

export async function toggleLessonComplete(
  lessonId: string,
  coursePath: string,
) {
  const user = await requireUser();
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } },
  });

  if (existing?.completedAt) {
    await db.lessonProgress.update({
      where: { id: existing.id },
      data: { completedAt: null },
    });
  } else {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, completedAt: new Date() },
      update: { completedAt: new Date() },
    });
  }

  revalidatePath(coursePath);
}
