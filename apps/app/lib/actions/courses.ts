"use server";

import { db, type VideoProvider } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_URL, postToSlack } from "../notify";
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

  const before = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!before) return;

  const moved = await relocation(
    courseId,
    before,
    String(formData.get("sectionId") ?? "").trim(),
  );

  await db.lesson.update({
    where: { id: lessonId },
    data: {
      ...moved,
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
  if (before && !before.published && formData.get("published") === "on") {
    await postToSlack(
      `🎓 New lesson published: *${before.title}* in ${before.section.course.title}\n${APP_URL}/courses/${before.section.course.slug}/${String(formData.get("slug") ?? before.slug).trim() || before.slug}`,
    );
  }

  revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath("/courses");
}

/**
 * Curriculum ordering (GitHub issue #2).
 *
 * `order` was only ever set to last+1 at creation, so inserting a lesson into
 * the middle of a module was impossible without SQL. These write the whole
 * sibling list back as 0..n-1 rather than swapping two rows: seeded and
 * hand-edited content already contains duplicate and gapped orders, and a
 * two-row swap silently does nothing when both rows hold the same number.
 */
type Direction = "up" | "down";

function swapped<T extends { id: string }>(
  rows: T[],
  id: string,
  direction: Direction,
): T[] | null {
  const from = rows.findIndex((r) => r.id === id);
  if (from < 0) return null;
  const to = from + (direction === "up" ? -1 : 1);
  if (to < 0 || to >= rows.length) return null; // already at the end
  const next = [...rows];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export async function moveSection(
  courseId: string,
  sectionId: string,
  direction: Direction,
) {
  await requireAdmin();
  const sections = await db.section.findMany({
    where: { courseId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const next = swapped(sections, sectionId, direction);
  if (!next) return;

  await db.$transaction(
    next.map((s, i) =>
      db.section.update({ where: { id: s.id }, data: { order: i } }),
    ),
  );
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
}

export async function moveLesson(
  courseId: string,
  sectionId: string,
  lessonId: string,
  direction: Direction,
) {
  await requireAdmin();
  const lessons = await db.lesson.findMany({
    where: { sectionId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const next = swapped(lessons, lessonId, direction);
  if (!next) return;

  await db.$transaction(
    next.map((l, i) =>
      db.lesson.update({ where: { id: l.id }, data: { order: i } }),
    ),
  );
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses");
}

/**
 * Where a lesson should land if it's being moved into another section: the
 * end of the target. Returns undefined when the section isn't changing, so
 * `updateLesson` can leave `order` alone.
 *
 * The target is scoped to the course so a tampered form value can't relocate
 * a lesson into a different curriculum.
 */
async function relocation(
  courseId: string,
  lesson: { sectionId: string },
  requested: string,
): Promise<{ sectionId: string; order: number } | undefined> {
  if (!requested || requested === lesson.sectionId) return undefined;
  const target = await db.section.findFirst({
    where: { id: requested, courseId },
    select: { id: true },
  });
  if (!target) return undefined;
  const last = await db.lesson.findFirst({
    where: { sectionId: target.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return { sectionId: target.id, order: (last?.order ?? -1) + 1 };
}

export async function deleteLesson(lessonId: string, courseId: string) {
  await requireAdmin();
  await db.lesson.delete({ where: { id: lessonId } });
  revalidatePath(`/admin/courses/${courseId}`);
  redirect(`/admin/courses/${courseId}`);
}
