import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import {
  createLesson,
  createSection,
  deleteSection,
  updateCourse,
} from "@/lib/actions/courses";
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requireAdmin();
  const { courseId } = await params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { transcript: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!course) notFound();

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: course.title }]}
        title={course.title}
        subtitle="Sections hold lessons; lessons hold the video and the transcript the tutor reads."
        actions={
          <Link href={`/courses/${course.slug}`} className="hr-btn hr-btn-sm">
            View live
          </Link>
        }
      />

      <section className="hr-card mb-4 p-5">
        <h2 className="mb-4 text-[13px] font-semibold">Course settings</h2>
        <form
          action={updateCourse.bind(null, course.id)}
          className="flex flex-col gap-3 text-sm"
        >
          <label className="flex flex-col gap-1 font-medium">
            Title
            <input
              name="title"
              defaultValue={course.title}
              className="hr-input font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Slug
            <input
              name="slug"
              defaultValue={course.slug}
              className="hr-input font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Description
            <textarea
              name="description"
              defaultValue={course.description ?? ""}
              rows={2}
              className="hr-input font-normal"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              SEO title
              <input
                name="seoTitle"
                defaultValue={course.seoTitle ?? ""}
                className="hr-input font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              SEO description
              <input
                name="seoDescription"
                defaultValue={course.seoDescription ?? ""}
                className="hr-input font-normal"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              name="published"
              defaultChecked={course.published}
            />
            Published
          </label>
          <button
            type="submit"
            className="hr-btn hr-btn-primary hr-btn-sm self-start"
          >
            Save
          </button>
        </form>
      </section>

      <section className="space-y-6">
        <h2 className="text-[13px] font-semibold">Curriculum</h2>
        {course.sections.map((section) => (
          <div key={section.id} className="hr-card mb-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{section.title}</h3>
              <form action={deleteSection.bind(null, section.id, course.id)}>
                <button className="text-xs text-fail hover:underline">
                  delete section
                </button>
              </form>
            </div>
            <ul className="mb-4 divide-y divide-line">
              {section.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                  className="block hover:bg-bg"
                >
                  <li className="flex items-center justify-between px-2 py-2 text-sm">
                    <span>{lesson.title}</span>
                    <span className="flex gap-2 text-xs">
                      {lesson.videoProvider !== "NONE" && (
                        <span className="text-dim">
                          {lesson.videoProvider.toLowerCase()}
                        </span>
                      )}
                      {lesson.transcript && (
                        <span className="text-acc">transcript ✓</span>
                      )}
                      {!lesson.published && (
                        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-warn">
                          draft
                        </span>
                      )}
                    </span>
                  </li>
                </Link>
              ))}
            </ul>
            <form
              action={createLesson.bind(null, section.id, course.id)}
              className="flex gap-2"
            >
              <input
                name="title"
                placeholder="New lesson title"
                required
                className="hr-input flex-1"
              />
              <button className="hr-btn hr-btn-sm">
                Add lesson
              </button>
            </form>
          </div>
        ))}
        <form
          action={createSection.bind(null, course.id)}
          className="flex gap-2"
        >
          <input
            name="title"
            placeholder="New section title"
            required
            className="hr-input flex-1"
          />
          <button className="hr-btn hr-btn-primary hr-btn-sm">
            Add section
          </button>
        </form>
      </section>
    </Page>
  );
}
