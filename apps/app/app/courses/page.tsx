import Link from "next/link";
import { db } from "@homeroom/db";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  const courses = await db.course.findMany({
    where: user?.role === "ADMIN" ? {} : { published: true },
    orderBy: { createdAt: "asc" },
    include: {
      sections: {
        include: { lessons: { where: { published: true }, select: { id: true } } },
      },
    },
  });

  const completedByCourse = new Map<string, number>();
  if (user) {
    const progress = await db.lessonProgress.findMany({
      where: { userId: user.id, completedAt: { not: null } },
      select: { lessonId: true },
    });
    const completedIds = new Set(progress.map((p) => p.lessonId));
    for (const course of courses) {
      const lessonIds = course.sections.flatMap((s) => s.lessons.map((l) => l.id));
      completedByCourse.set(
        course.id,
        lessonIds.filter((id) => completedIds.has(id)).length,
      );
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Courses</h1>
      {courses.length === 0 &&
        (user?.role === "ADMIN" ? (
          <EmptyState
            glyph="▷"
            title="No courses yet"
            body="A course holds sections, lessons and the exercises that prove them. Create one, add a lesson, drop in its transcript — the agent drafts the rest."
            actionLabel="Create your first course"
            actionHref="/admin"
          />
        ) : (
          <EmptyState
            glyph="▷"
            title="Nothing published yet"
            body="Your instructor hasn't published a course here yet. You'll get an email the moment the first lesson goes live."
          />
        ))}
      <div className="grid gap-6 sm:grid-cols-2">
        {courses.map((course) => {
          const total = course.sections.reduce(
            (n, s) => n + s.lessons.length,
            0,
          );
          const done = completedByCourse.get(course.id) ?? 0;
          return (
            <Link
              key={course.id}
              href={`/courses/${course.slug}`}
              className="rounded-xl border border-line p-6 transition-colors hover:border-dim"
            >
              <h2 className="text-lg font-semibold">
                {course.title}
                {!course.published && (
                  <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">
                    draft
                  </span>
                )}
              </h2>
              {course.description && (
                <p className="mt-2 line-clamp-2 text-sm text-dim">
                  {course.description}
                </p>
              )}
              <p className="mt-4 text-xs text-dim">
                {total} lesson{total === 1 ? "" : "s"}
                {user && total > 0 && ` · ${Math.round((done / total) * 100)}% complete`}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
