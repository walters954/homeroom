import Link from "next/link";
import { db } from "@homeroom/db";
import { createCourse } from "@/lib/actions/courses";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const courses = await db.course.findMany({
    orderBy: { createdAt: "asc" },
    include: { sections: { include: { lessons: { select: { id: true } } } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Admin</h1>
      <p className="mb-8 text-sm text-dim">
        <Link href="/admin/members" className="underline hover:text-ink">
          Members
        </Link>
        {" · "}
        <Link href="/admin/products" className="underline hover:text-ink">
          Products &amp; pricing
        </Link>
        {" · "}
        <Link href="/admin/suggestions" className="underline hover:text-ink">
          Agent suggestions
        </Link>
        {" · "}
        <Link href="/admin/settings" className="underline hover:text-ink">
          Settings
        </Link>
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Courses</h2>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/admin/courses/${course.id}`}
              className="block hover:bg-bg"
            >
              <li className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {course.title}
                  {!course.published && (
                    <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">
                      draft
                    </span>
                  )}
                </span>
                <span className="text-dim">
                  {course.sections.reduce((n, s) => n + s.lessons.length, 0)}{" "}
                  lessons
                </span>
              </li>
            </Link>
          ))}
          {courses.length === 0 && (
            <li className="px-4 py-3 text-sm text-dim">No courses yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">New course</h2>
        <form action={createCourse} className="flex flex-col gap-3">
          <input
            name="title"
            placeholder="Course title"
            required
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
          <textarea
            name="description"
            placeholder="Short description (optional)"
            rows={2}
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-ink hover:opacity-90"
          >
            Create course
          </button>
        </form>
      </section>
    </main>
  );
}
