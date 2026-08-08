import Link from "next/link";
import { db } from "@homeroom/db";
import { Page, PageHeader } from "@/components/page-header";
import { createCourse } from "@/lib/actions/courses";
import { plural } from "@/lib/practice";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const courses = await db.course.findMany({
    orderBy: { createdAt: "asc" },
    include: { sections: { include: { lessons: { select: { id: true } } } } },
  });

  const published = courses.filter((c) => c.published).length;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin" }]}
        title="Courses"
        subtitle={
          courses.length > 0
            ? `${plural(courses.length, "course")}, ${published} published. Everything else lives on the rail — coach, members, products, the agent queue and settings.`
            : "Nothing exists yet. A course is the container everything else hangs off, so it is the first thing to make."
        }
      />

      <section className="hr-card">
        <div className="hr-card-h">
          <span className="font-semibold">All courses</span>
          <span className="ml-auto hr-path">{courses.length}</span>
        </div>
        {courses.length === 0 ? (
          <div className="hr-card-b">
            <p className="text-[12.5px] text-dim">
              Create one below and it will appear here with its lesson count.
            </p>
          </div>
        ) : (
          <ul>
            {courses.map((course) => {
              const lessons = course.sections.reduce(
                (n, s) => n + s.lessons.length,
                0,
              );
              return (
                <li key={course.id} className="hr-row items-start">
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="block font-medium text-ink hover:underline"
                    >
                      {course.title}
                    </Link>
                    <span className="hr-ev block">
                      {plural(lessons, "lesson")}
                      {lessons === 0 && " · nothing to watch yet"}
                    </span>
                  </span>
                  <span
                    className={`hr-tag shrink-0 ${
                      course.published ? "hr-tag-proven" : "hr-tag-untested"
                    }`}
                  >
                    {course.published ? "published" : "draft"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="hr-card mt-4">
        <div className="hr-card-h">
          <span className="font-semibold">New course</span>
        </div>
        <form action={createCourse}>
          <div className="hr-card-b space-y-3">
            <label className="block">
              <span className="hr-eyebrow mb-1 block">Title</span>
              <input
                name="title"
                placeholder="Apex That Survives Production"
                required
                className="hr-input"
              />
            </label>
            <label className="block">
              <span className="hr-eyebrow mb-1 block">Description</span>
              <textarea
                name="description"
                placeholder="What someone can do after finishing it — optional."
                rows={2}
                className="hr-input"
              />
            </label>
          </div>
          <div className="hr-card-f">
            <button type="submit" className="hr-btn hr-btn-primary hr-btn-sm">
              Create course
            </button>
            <span className="hr-ev">
              Created as a draft. Nothing is member-visible until you publish it.
            </span>
          </div>
        </form>
      </section>
    </Page>
  );
}
