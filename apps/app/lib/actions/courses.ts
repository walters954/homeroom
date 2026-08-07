"use server";

import { db, type VideoProvider } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../session";
import { slugify } from "../slug";

export async function createCourse(formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const course = await db.course.create({
    data: {
      title,
      slug: slugify(title) || `course-${Date.now()}`,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(courseId: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  await db.course.update({
    where: { id: courseId },
    data: {
      title: title || undefined,
      slug: String(formData.get("slug") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || null,
      coverImageUrl: String(formData.get("coverImageUrl") ?? "").trim() || null,
      published: formData.get("published") === "on",
      seoTitle: String(formData.get("seoTitle") ?? "").trim() || null,
      seoDescription:
        String(formData.get("seoDescription") ?? "").trim() || null,
    },
  });
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
}

export async function createSection(courseId: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const last = await db.section.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
  });
  await db.section.create({
    data: { courseId, title, order: (last?.order ?? 0) + 1 },
  });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function deleteSection(sectionId: string, courseId: string) {
  await requireAdmin();
  await db.section.delete({ where: { id: sectionId } });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createLesson(
  sectionId: string,
  courseId: string,
  formData: FormData,
) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const last = await db.lesson.findFirst({
    where: { sectionId },
    orderBy: { order: "desc" },
  });
  const lesson = await db.lesson.create({
    data: {
      sectionId,
      title,
      slug: slugify(title) || `lesson-${Date.now()}`,
      order: (last?.order ?? 0) + 1,
    },
  });
  redirect(`/admin/courses/${courseId}/lessons/${lesson.id}`);
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  formData: FormData,
) {
  await requireAdmin();
  const markdown = String(formData.get("body") ?? "");
  const provider = String(
    formData.get("videoProvider") ?? "NONE",
  ) as VideoProvider;
  const duration = parseInt(String(formData.get("durationSeconds") ?? ""), 10);

  await db.lesson.update({
    where: { id: lessonId },
    data: {
      title: String(formData.get("title") ?? "").trim() || undefined,
      slug: String(formData.get("slug") ?? "").trim() || undefined,
      body: markdown ? { markdown } : undefined,
      videoProvider: provider,
      videoId: String(formData.get("videoId") ?? "").trim() || null,
      durationSeconds: Number.isNaN(duration) ? null : duration,
      published: formData.get("published") === "on",
      isPublicPreview: formData.get("isPublicPreview") === "on",
      seoTitle: String(formData.get("seoTitle") ?? "").trim() || null,
      seoDescription:
        String(formData.get("seoDescription") ?? "").trim() || null,
    },
  });
  revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath("/courses");
}

export async function deleteLesson(lessonId: string, courseId: string) {
  await requireAdmin();
  await db.lesson.delete({ where: { id: lessonId } });
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(`/admin/courses/${courseId}`);
}
